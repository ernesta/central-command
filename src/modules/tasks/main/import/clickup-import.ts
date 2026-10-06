import { daysBetween, dayNumber } from '@shared/year'
import type { NewTask, TaskPriority, TaskStatus, TaskWorkspace } from '../../shared/types'

/** The columns the importer reads; a CSV without one of them is refused. */
const COLUMNS = [
  'Task ID',
  'Task Name',
  'Task Content',
  'Status',
  'Date Created',
  'Due Date Text',
  'Parent ID',
  'Subtasks IDs',
  'Attachments',
  'Tags',
  'Priority',
  'List Name',
  'Folder Name/Path',
  'Space Name',
  'Time Spent',
  'Checklists',
  'Comments'
] as const

export interface ClickupRow {
  id: string
  name: string
  content: string
  status: string
  createdMs: number
  /** The calendar date the user saw (the date part of `Due Date Text`), or null. */
  due: string | null
  parentId: string | null
  subtaskIds: string[]
  attachments: { title: string; url: string }[]
  tags: string[]
  priority: string
  listName: string
  folders: string[]
  space: string
  /** Milliseconds, from the task's own `Time Spent`. */
  timeMs: number
  hasChecklist: boolean
  hasComments: boolean
}

const isNull = (v: string): boolean => v.trim() === '' || v.trim() === 'null'

/** `"M/D/YYYY, h:mm:ss AM GMT+1"` to `YYYY-MM-DD`: the date as written, with no time zone conversion. */
export function dueDateOf(text: string): string | null {
  if (isNull(text)) return null
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text.trim())
  if (!m) throw new Error(`Cannot read the due date "${text}"`)
  const pad = (n: string): string => n.padStart(2, '0')
  const date = `${m[3]}-${pad(m[1])}-${pad(m[2])}`
  if (dayNumber(date) === null) throw new Error(`Not a date: "${text}"`)
  return date
}

function parseTimeMs(raw: string): number {
  const v = raw.trim().replace(/^"|"$/g, '').trim()
  if (v === '' || v === 'null' || v === 'NaN') return 0
  if (!/^\d+$/.test(v)) throw new Error(`Cannot read the time "${raw}"`)
  return Number(v)
}

function parseList(raw: string): string[] {
  const inner = raw.trim().replace(/^\[|\]$/g, '')
  return inner === ''
    ? []
    : inner
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
}

function parseFolders(raw: string): string[] {
  if (isNull(raw)) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return value as string[]
  } catch {
    // fall through to the error below
  }
  throw new Error(`Cannot read the folder "${raw}"`)
}

function parseAttachments(raw: string): { title: string; url: string }[] {
  if (isNull(raw) || raw.trim() === '[]') return []
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value)) throw new Error(`Cannot read the attachments "${raw}"`)
  return value.map((a) => {
    const o = a as { title?: unknown; url?: unknown }
    return { title: String(o.title ?? ''), url: String(o.url ?? '') }
  })
}

export class DifferingDuplicateError extends Error {}

export interface Deduplicated {
  rowsBefore: number
  rowsAfter: number
  /** How many ids appear more than once. */
  repeatedIds: number
  rows: ClickupRow[]
}

/**
 * Turn CSV records (the first is the header) into one row per `Task ID`. The export lists most tasks twice, the rows
 * identical; if two rows with one id differ in any cell this throws, because then it is not a repeat but a conflict.
 */
export function readClickup(records: string[][]): Deduplicated {
  if (records.length === 0) throw new Error('The CSV is empty')
  const header = records[0]
  const at = new Map(header.map((h, i) => [h.trim(), i]))
  for (const name of COLUMNS) {
    if (!at.has(name)) throw new Error(`The CSV has no "${name}" column`)
  }
  const idAt = at.get('Task ID') as number
  const seen = new Map<string, string[]>()
  const repeated = new Set<string>()
  const body = records.slice(1)
  for (const record of body) {
    if (record.length !== header.length) {
      throw new Error(`A row has ${record.length} cells, the header has ${header.length}`)
    }
    const id = record[idAt].trim()
    if (!id) throw new Error('A row has no Task ID')
    const first = seen.get(id)
    if (!first) seen.set(id, record)
    else {
      repeated.add(id)
      if (first.some((cell, i) => cell !== record[i])) {
        const differs = header.filter((_, i) => first[i] !== record[i])
        throw new DifferingDuplicateError(
          `Two rows with Task ID ${id} differ (${differs.join(', ')}). Not importing: look at them first.`
        )
      }
    }
  }
  const cell = (r: string[], name: (typeof COLUMNS)[number]): string =>
    r[at.get(name) as number] ?? ''
  const rows = [...seen.values()].map((r): ClickupRow => {
    const checklists = cell(r, 'Checklists').trim()
    const comments = cell(r, 'Comments').trim()
    return {
      id: cell(r, 'Task ID').trim(),
      name: cell(r, 'Task Name').trim(),
      // The export writes line breaks in the text as a backslash and an n.
      content: isNull(cell(r, 'Task Content'))
        ? ''
        : cell(r, 'Task Content').replace(/\\n/g, '\n').replace(/\s+$/, ''),
      status: cell(r, 'Status').trim(),
      createdMs: Number(cell(r, 'Date Created')) || 0,
      due: dueDateOf(cell(r, 'Due Date Text')),
      parentId: isNull(cell(r, 'Parent ID')) ? null : cell(r, 'Parent ID').trim(),
      subtaskIds: parseList(cell(r, 'Subtasks IDs')),
      attachments: parseAttachments(cell(r, 'Attachments')),
      tags: parseList(cell(r, 'Tags')),
      priority: cell(r, 'Priority').trim(),
      listName: cell(r, 'List Name').trim(),
      folders: parseFolders(cell(r, 'Folder Name/Path')),
      space: cell(r, 'Space Name').trim(),
      timeMs: parseTimeMs(cell(r, 'Time Spent')),
      hasChecklist: !isNull(checklists) && checklists !== '{}' && checklists !== '[]',
      hasComments: !isNull(comments) && comments !== '[]'
    }
  })
  return { rowsBefore: body.length, rowsAfter: rows.length, repeatedIds: repeated.size, rows }
}

const SPACES: Record<string, TaskWorkspace> = { 'PhD Studies': 'research', Consulting: 'work' }
const STATUSES: Record<string, TaskStatus> = {
  'to do': 'todo',
  'in progress': 'doing',
  complete: 'done'
}

/** ClickUp 1 and 2 are High, 3 and none Normal, 4 Low. */
function priorityOf(raw: string): TaskPriority | null {
  if (raw === '1' || raw === '2') return 'high'
  if (raw === '3' || raw === 'null' || raw === '') return 'normal'
  if (raw === '4') return 'low'
  return null
}

export interface PlannedTask {
  sourceId: string
  /** The `sourceId` of the task this is a subtask of, after flattening. */
  parentSourceId: string | null
  input: Omit<NewTask, 'parentUid'>
}

export interface LeftOut {
  sourceId: string
  title: string
  reason: string
}

export interface SeriesProposal {
  title: string
  list: string
  instances: number
  openDue: string | null
  medianGapDays: number | null
  rule: string
}

export interface OtherRepeat {
  title: string
  list: string
  instances: number
  open: number
}

export interface ImportReport {
  rowsBefore: number
  rowsAfter: number
  repeatedIds: number
  planned: number
  leftOut: LeftOut[]
  byWorkspace: Record<TaskWorkspace, number>
  byStatus: Record<TaskStatus, number>
  byPriority: Record<TaskPriority, number>
  topLevel: number
  subtasks: number
  tasksWithTime: number
  totalMinutes: number
  /** Subtask dates dropped because they repeated the parent's, and ones kept. */
  /** Subtasks that have a date (all of them are kept as they are). */
  subtaskDatesKept: number
  /** Top-level tasks that had no date and took the earliest date of an open subtask. */
  parentsTookDate: { title: string; due: string }[]
  flattened: { title: string; newTitle: string; underTitle: string }[]
  attachments: { task: string; title: string; url: string }[]
  /** Checklists or comments the export holds, which nothing imports (none today). */
  unimported: string[]
  /** `Subtasks IDs` that do not match the tasks that name a parent. */
  subtaskIdMismatches: string[]
  series: SeriesProposal[]
  otherRepeats: OtherRepeat[]
}

export interface ImportPlan {
  tasks: PlannedTask[]
  report: ImportReport
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function proposeRule(gap: number | null): string {
  if (gap === null) return 'unclear'
  if (gap >= 0.5 && gap <= 1.5) return 'every day'
  if (gap >= 5 && gap <= 9) return 'every week'
  if (gap >= 12 && gap <= 16) return 'every 2 weeks'
  if (gap >= 26 && gap <= 35) return 'every month'
  return 'unclear'
}

/** Top-level tasks that look like a series (the same title in the same list, four or more times) with exactly one open. */
function proposeSeries(tasks: PlannedTask[]): { series: SeriesProposal[]; others: OtherRepeat[] } {
  const groups = new Map<string, PlannedTask[]>()
  for (const t of tasks) {
    if (t.parentSourceId) continue
    const key = `${t.input.workspace}\u0000${t.input.list}\u0000${t.input.title.toLowerCase()}`
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  const out: SeriesProposal[] = []
  const others: OtherRepeat[] = []
  for (const group of groups.values()) {
    if (group.length < 4) continue
    const open = group.filter((t) => t.input.status !== 'done')
    if (open.length !== 1) {
      others.push({
        title: group[0].input.title,
        list: group[0].input.list ?? '',
        instances: group.length,
        open: open.length
      })
      continue
    }
    const dates = group
      .map((t) => t.input.due)
      .filter((d): d is string => d !== null && d !== undefined)
      .sort()
    const gaps = dates
      .slice(1)
      .map((d, i) => daysBetween(dates[i], d))
      .filter((g) => g > 0)
    const gap = median(gaps)
    out.push({
      title: group[0].input.title,
      list: group[0].input.list ?? '',
      instances: group.length,
      openDue: open[0].input.due ?? null,
      medianGapDays: gap,
      rule: proposeRule(gap)
    })
  }
  const byName = (a: { list: string; title: string }, b: { list: string; title: string }): number =>
    a.list.localeCompare(b.list) || a.title.localeCompare(b.title)
  return { series: out.sort(byName), others: others.sort(byName) }
}

/**
 * Turn the de-duplicated rows into tasks, with every rule of the plan applied and checked. A task that fails a check is
 * left out and listed (and so are its subtasks); nothing disappears silently.
 */
export function planImport(data: Deduplicated): ImportPlan {
  const rows = data.rows
  const byId = new Map(rows.map((r) => [r.id, r]))
  const leftOut = new Map<string, LeftOut>()
  const fail = (r: ClickupRow, reason: string): void => {
    if (!leftOut.has(r.id)) leftOut.set(r.id, { sourceId: r.id, title: r.name, reason })
  }

  for (const r of rows) {
    if (!r.name) fail(r, 'no title')
    if (!(r.status in STATUSES)) fail(r, `unknown status "${r.status}"`)
    if (!(r.space in SPACES)) fail(r, `unknown space "${r.space}"`)
    if (priorityOf(r.priority) === null) fail(r, `unknown priority "${r.priority}"`)
    if (r.parentId && !byId.has(r.parentId)) fail(r, `its parent ${r.parentId} is not in the file`)
    if (!r.parentId && !r.listName) fail(r, 'no list')
  }
  // A task whose parent was left out is left out too, however deep.
  for (let changed = true; changed;) {
    changed = false
    for (const r of rows) {
      if (r.parentId && leftOut.has(r.parentId) && !leftOut.has(r.id)) {
        fail(r, `its parent ${r.parentId} was left out`)
        changed = true
      }
    }
  }

  // Depth: a subtask of a subtask moves up to the top-level task, under a title that names its former parent.
  const topOf = (r: ClickupRow): ClickupRow => {
    let cur = r
    const seen = new Set<string>()
    while (cur.parentId) {
      if (seen.has(cur.id)) throw new Error(`Task ${cur.id} is its own ancestor`)
      seen.add(cur.id)
      cur = byId.get(cur.parentId) as ClickupRow
    }
    return cur
  }

  const kept = rows.filter((r) => !leftOut.has(r.id))
  const flattened: ImportReport['flattened'] = []
  let datesKept = 0
  const parentsTookDate: ImportReport['parentsTookDate'] = []

  // Order of subtasks: the parent's own list of ids first, then any moved up from below, in file order.
  const order = new Map<string, number>()
  const childrenOf = new Map<string, ClickupRow[]>()
  for (const r of kept)
    if (r.parentId) childrenOf.set(r.parentId, [...(childrenOf.get(r.parentId) ?? []), r])
  const subtaskIdMismatches: string[] = []
  for (const r of kept) {
    const named = new Set(r.subtaskIds)
    const actual = new Set((childrenOf.get(r.id) ?? []).map((c) => c.id))
    // The column is empty for most parents in the export, so only a parent that lists some is checked.
    if (
      named.size > 0 &&
      (named.size !== actual.size || [...named].some((id) => !actual.has(id)))
    ) {
      subtaskIdMismatches.push(`${r.name} (${r.id}): lists ${named.size}, found ${actual.size}`)
    }
  }
  const nextPosition = new Map<string, number>()
  const positionFor = (top: string, id: string): number => {
    if (order.has(id)) return order.get(id) as number
    const n = (nextPosition.get(top) ?? 0) + 1
    nextPosition.set(top, n)
    order.set(id, n)
    return n
  }
  // Direct children first in the parent's listed order, so their positions come before moved-up ones.
  for (const r of kept) {
    if (r.parentId) continue
    for (const id of r.subtaskIds) {
      const child = byId.get(id)
      if (child && child.parentId === r.id && !leftOut.has(id)) positionFor(r.id, id)
    }
  }

  const tasks: PlannedTask[] = []
  for (const r of kept) {
    const workspace = SPACES[r.space]
    const status = STATUSES[r.status]
    const parent = r.parentId ? (byId.get(r.parentId) as ClickupRow) : null
    const top = topOf(r)
    const isSub = parent !== null
    let title = r.name
    let parentSourceId: string | null = null
    const due = r.due
    if (isSub) {
      parentSourceId = top.id
      if (parent.parentId) {
        title = `${parent.name} › ${r.name}`
        flattened.push({ title: r.name, newTitle: title, underTitle: top.name })
      }
      // Every subtask keeps the date it has, also when it repeats its parent's.
      if (due !== null) datesKept++
    }
    const attachmentsText = r.attachments.map((a) => `- [${a.title}](${a.url})`).join('\n')
    const description =
      attachmentsText === ''
        ? r.content
        : `${r.content}${r.content ? '\n\n' : ''}Attachments from ClickUp:\n\n${attachmentsText}`
    tasks.push({
      sourceId: r.id,
      parentSourceId,
      input: {
        workspace,
        title,
        description,
        status,
        priority: isSub ? 'normal' : (priorityOf(r.priority) as TaskPriority),
        due,
        list: isSub ? '' : r.folders.length > 0 ? r.folders[0] : r.listName,
        sublist: isSub ? '' : r.folders.length > 0 ? r.listName : '',
        tags: r.tags,
        earlierMinutes: Math.round(r.timeMs / 60000),
        sourceId: r.id,
        createdAt: r.createdMs ? new Date(r.createdMs).toISOString() : undefined,
        completedAt: status === 'done' ? null : undefined,
        position: isSub ? positionFor(top.id, r.id) : undefined
      }
    })
  }

  // A top-level task with no date and a dated open subtask takes the earliest of those dates.
  for (const t of tasks) {
    if (t.parentSourceId || t.input.due || t.input.status === 'done') continue
    const dates = tasks
      .filter((k) => k.parentSourceId === t.sourceId && k.input.status !== 'done' && k.input.due)
      .map((k) => k.input.due as string)
      .sort()
    if (dates.length > 0) {
      t.input.due = dates[0]
      parentsTookDate.push({ title: t.input.title, due: dates[0] })
    }
  }

  const byWorkspace = { research: 0, work: 0 }
  const byStatus = { todo: 0, doing: 0, done: 0 }
  const byPriority = { high: 0, normal: 0, low: 0 }
  let topLevel = 0
  let subtasks = 0
  let tasksWithTime = 0
  let totalMinutes = 0
  for (const t of tasks) {
    byWorkspace[t.input.workspace]++
    byStatus[t.input.status as TaskStatus]++
    if (t.parentSourceId) subtasks++
    else {
      topLevel++
      byPriority[t.input.priority as TaskPriority]++
    }
    if ((t.input.earlierMinutes ?? 0) > 0) tasksWithTime++
    totalMinutes += t.input.earlierMinutes ?? 0
  }

  const { series, others } = proposeSeries(tasks)
  return {
    tasks,
    report: {
      rowsBefore: data.rowsBefore,
      rowsAfter: data.rowsAfter,
      repeatedIds: data.repeatedIds,
      planned: tasks.length,
      leftOut: [...leftOut.values()],
      byWorkspace,
      byStatus,
      byPriority,
      topLevel,
      subtasks,
      tasksWithTime,
      totalMinutes,
      subtaskDatesKept: datesKept,
      parentsTookDate,
      flattened,
      attachments: kept.flatMap((r) =>
        r.attachments.map((a) => ({ task: r.name, title: a.title, url: a.url }))
      ),
      unimported: kept.flatMap((r) => [
        ...(r.hasChecklist ? [`${r.name} (${r.id}) has a checklist`] : []),
        ...(r.hasComments ? [`${r.name} (${r.id}) has comments`] : [])
      ]),
      subtaskIdMismatches,
      series,
      otherRepeats: others
    }
  }
}

/** What the de-duplicated CSV itself says, to compare the plan with. */
export interface SourceTotals {
  byStatus: Record<TaskStatus, number>
  totalMinutes: number
  topLevel: number
  subtasks: number
  rows: number
}

export function sourceTotals(rows: readonly ClickupRow[]): SourceTotals {
  const byStatus = { todo: 0, doing: 0, done: 0 }
  let minutes = 0
  for (const r of rows) {
    const s = STATUSES[r.status]
    if (s) byStatus[s]++
    minutes += Math.round(r.timeMs / 60000)
  }
  return {
    byStatus,
    totalMinutes: minutes,
    topLevel: rows.filter((r) => !r.parentId).length,
    subtasks: rows.filter((r) => r.parentId).length,
    rows: rows.length
  }
}

/** The checks that must all hold before anything is written; each returns what is wrong, or nothing. */
export function checkPlan(plan: ImportPlan, source: SourceTotals): string[] {
  const r = plan.report
  const problems: string[] = []
  if (r.planned + r.leftOut.length !== source.rows) {
    problems.push(
      `${source.rows} tasks in the file, but ${r.planned} planned and ${r.leftOut.length} left out`
    )
  }
  if (r.leftOut.length > 0) problems.push(`${r.leftOut.length} task(s) left out (listed below)`)
  if (r.leftOut.length === 0) {
    for (const s of ['todo', 'doing', 'done'] as const) {
      if (r.byStatus[s] !== source.byStatus[s]) {
        problems.push(`status ${s}: ${r.byStatus[s]} planned, ${source.byStatus[s]} in the file`)
      }
    }
    if (r.totalMinutes !== source.totalMinutes) {
      problems.push(`time: ${r.totalMinutes} min planned, ${source.totalMinutes} min in the file`)
    }
    if (r.topLevel !== source.topLevel || r.subtasks !== source.subtasks) {
      problems.push(
        `top-level/subtasks: ${r.topLevel}/${r.subtasks} planned, ${source.topLevel}/${source.subtasks} in the file`
      )
    }
  }
  if (r.unimported.length > 0)
    problems.push(`${r.unimported.length} checklist/comment(s) would not be imported`)
  return problems
}
