/**
 * The end state of the linking work, planned without touching any file. Input: the user's worksheet and ClickUp changes. Output: for
 * every task its final name, date and ClickUp time, the tasks to make or retire, and for every hours entry its task and whether
 * ClickUp's time already holds it (`earlier`). The rules (the user, 6 Oct 2026):
 *  - each hours entry belongs to one task; hours never change;
 *  - a task's ClickUp time after the splits, merges and moves equals the hours given to it (or it has none and carries hours only);
 *  - a linked task whose entries all say the same thing is renamed to that wording; one that gathers differently worded entries keeps
 *    its ClickUp name; every linked task is dated on its last typed entry;
 *  - every linked task is billable.
 */
import { formatHours } from '@shared/tracking/format'
import type { Change, TrackingYear } from '@shared/tracking/types'
import {
  applyChanges,
  parseNewTask,
  type ParsedRow,
  type SheetEntry,
  type SheetTask,
  type TaskChange
} from './work-links-sheet'

export interface ApplyTask extends SheetTask {
  status: string
  tags: string[]
  parentUid: string | null
}

export interface TaskPlan {
  /** An existing task's uid, or `split:n` / `new:n` for a task to make. */
  target: string
  existing: boolean
  oldTitle: string
  title: string
  /** ClickUp minutes after the changes. */
  earlier: number
  due: string
  list: string
  sublist: string
  status: string
  /** The tag billable has to be added. */
  tagBillable: boolean
  hours: number
  entries: number
}

export interface EntryLink {
  key: string
  target: string
  /** ClickUp's time already holds this entry (never for a timer). */
  earlier: boolean
}

export interface FinalPlan {
  problems: string[]
  tasks: TaskPlan[]
  /** Tasks merged into another: retire them. */
  retire: string[]
  links: EntryLink[]
}

export function planFinal(input: {
  tasks: readonly ApplyTask[]
  names: ReadonlyMap<string, string>
  entries: readonly SheetEntry[]
  rows: readonly ParsedRow[]
  changes: readonly TaskChange[]
}): FinalPlan {
  const problems: string[] = []
  const changed = applyChanges(input.tasks, input.names, input.changes)
  problems.push(...changed.problems)
  const byName = new Map([...changed.names].map(([uid, n]) => [n.toLowerCase(), uid]))
  const entry = new Map(input.entries.map((e) => [e.key, e]))
  const retire = input.tasks
    .filter((t) => !changed.tasks.some((c) => c.uid === t.uid))
    .map((t) => t.uid)
  const children = new Set(
    input.tasks.map((t) => t.parentUid).filter((p): p is string => p !== null)
  )
  for (const uid of retire)
    if (children.has(uid)) problems.push(`A merged task has subtasks (${uid}); not handled.`)

  // Which task each entry goes to.
  const targetOf = new Map<string, string>()
  const fresh = new Map<string, { title: string; sublist: string; key: string }>()
  for (const r of input.rows) {
    if (!entry.has(r.id)) continue
    if (targetOf.has(r.id)) {
      problems.push(`Entry ${r.id} has more than one row: an entry belongs to one task.`)
      continue
    }
    const n = parseNewTask(r.task)
    if (n) {
      const key = `new:${n.title.toLowerCase()}|${n.sublist.toLowerCase()}`
      if (!fresh.has(key)) fresh.set(key, { ...n, key })
      targetOf.set(r.id, key)
    } else {
      const uid = byName.get(r.task.toLowerCase())
      if (!uid) problems.push(`Entry ${r.id}: no task called "${r.task}".`)
      else targetOf.set(r.id, uid)
    }
  }
  for (const e of input.entries)
    if (!targetOf.has(e.key))
      problems.push(`Entry ${e.key} (${e.date}, ${formatHours(e.minutes)}) has no task.`)

  const tasks: TaskPlan[] = []
  const links: EntryLink[] = []
  const targets = new Set(targetOf.values())
  for (const target of targets) {
    const own = [...targetOf]
      .filter(([, t]) => t === target)
      .map(([k]) => entry.get(k) as SheetEntry)
    const typed = own.filter((e) => e.kind === 'typed')
    const hours = own.reduce((a, e) => a + e.minutes, 0)
    const typedHours = typed.reduce((a, e) => a + e.minutes, 0)
    const existing = input.tasks.find((t) => t.uid === target)
    const current = changed.tasks.find((t) => t.uid === target)
    const f = fresh.get(target)
    const earlier = current ? current.minutes : 0
    if (earlier > 0 && earlier !== typedHours)
      problems.push(
        `"${changed.names.get(target)}": ClickUp ${formatHours(earlier)} but typed hours ${formatHours(typedHours)}.`
      )
    const sameWording = new Set(typed.map((e) => e.label.trim().toLowerCase())).size <= 1
    const named = (typed.length > 0 ? typed : own).sort(
      (a, b) => b.minutes - a.minutes || a.date.localeCompare(b.date)
    )[0]
    const dated = typed.length > 0 ? typed : own
    tasks.push({
      target,
      existing: existing !== undefined,
      oldTitle: existing ? existing.title : (changed.names.get(target) ?? f?.title ?? ''),
      // Entries that all say the same thing name the task; a task that gathers differently worded entries keeps its ClickUp name.
      title: sameWording ? named.label.trim() : (current?.title ?? named.label.trim()),
      earlier,
      due: dated
        .map((e) => e.date)
        .sort()
        .at(-1) as string,
      list: current ? current.list : 'Luminos',
      sublist: current ? current.sublist : (f?.sublist ?? ''),
      status: existing ? existing.status : 'done',
      tagBillable: existing ? !existing.tags.includes('billable') : true,
      hours,
      entries: own.length
    })
    for (const e of own)
      links.push({ key: e.key, target, earlier: e.kind === 'typed' && earlier > 0 })
  }
  // A task that still holds ClickUp time but no entry would lose that time.
  for (const t of changed.tasks)
    if (t.billable && t.minutes > 0 && !targets.has(t.uid))
      problems.push(
        `"${changed.names.get(t.uid)}" keeps ${formatHours(t.minutes)} of ClickUp time but has no hours.`
      )
  return { problems, tasks, retire, links }
}

/**
 * Give a year's entries their tasks: each typed entry or timer session gets `task` (a `cc://task/<uid>` key), and a typed entry gets
 * `earlier` when ClickUp's time already holds it. Nothing else changes. An id that is missing, listed twice, or already linked to
 * something else refuses the whole change; an entry already linked exactly so is left alone (so a second run changes nothing).
 */
export function applyEntryLinks(
  year: TrackingYear,
  links: readonly { id: string; task: string; earlier: boolean }[]
): Change {
  const wanted = new Map(links.map((l) => [l.id, l]))
  if (wanted.size !== links.length) return { ok: false, reason: 'duplicate-entry' }
  const seen = new Set<string>()
  let conflict = false
  const adjusts = year.adjusts.map((a) => {
    const l = wanted.get(a.id)
    if (!l) return a
    seen.add(a.id)
    if (a.task !== undefined || a.earlier !== undefined) {
      if (a.task !== l.task || (a.earlier === true) !== l.earlier) conflict = true
      return a
    }
    return { ...a, task: l.task, ...(l.earlier ? { earlier: true as const } : {}) }
  })
  const sessions = year.sessions.map((s) => {
    const l = wanted.get(s.id)
    if (!l) return s
    seen.add(s.id)
    if (l.earlier) conflict = true
    if (s.task !== undefined) {
      if (s.task !== l.task) conflict = true
      return s
    }
    return { ...s, task: l.task }
  })
  if (conflict) return { ok: false, reason: 'already-linked' }
  if (seen.size !== wanted.size) return { ok: false, reason: 'missing-entry' }
  return { ok: true, year: { ...year, adjusts, sessions } }
}

/**
 * Mark typed entries and ended timer sessions as held by ClickUp's time (`earlier`) once their task's ClickUp time has been raised to
 * cover them. Only an entry that already has a task qualifies; anything else refuses the whole change.
 */
export function markEarlier(year: TrackingYear, ids: readonly string[]): Change {
  const wanted = new Set(ids)
  if (wanted.size !== ids.length) return { ok: false, reason: 'duplicate-entry' }
  const seen = new Set<string>()
  let bad = false
  const adjusts = year.adjusts.map((a) => {
    if (!wanted.has(a.id)) return a
    seen.add(a.id)
    if (!a.task) bad = true
    return { ...a, earlier: true as const }
  })
  const sessions = year.sessions.map((s) => {
    if (!wanted.has(s.id)) return s
    seen.add(s.id)
    if (!s.task || s.end === null) bad = true
    return { ...s, earlier: true as const }
  })
  if (bad) return { ok: false, reason: 'not-linked' }
  if (seen.size !== wanted.size) return { ok: false, reason: 'missing-entry' }
  return { ok: true, year: { ...year, adjusts, sessions } }
}
