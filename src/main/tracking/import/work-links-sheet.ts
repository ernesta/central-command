/**
 * The worksheet for linking Work's hour entries to tasks: one row per entry (an entry that feeds several tasks gets a row for
 * each part), pre-filled with the best matches, which the user edits in a spreadsheet; and the check that reads it back and says,
 * task by task, what still does not add up. Pure: text in, text out.
 */
import { parseCsv } from '../../../modules/tasks/main/import/csv'
import { formatHours } from '@shared/tracking/format'
import type { Allocation } from './work-task-flow'
import {
  makeSimilarity,
  dayNumber,
  type Link,
  type LinkEntry,
  type LinkTask
} from './work-task-links'

export interface SheetEntry extends LinkEntry {
  client: string
  /** A timer session (it will link without `earlier`) or a typed entry. */
  kind: 'typed' | 'timer'
}
export interface SheetTask extends LinkTask {
  list: string
  sublist: string
}

export interface Row {
  id: string
  date: string
  client: string
  minutes: number
  label: string
  task: string
  note: string
}

const COLUMNS = ['id', 'date', 'client', 'hours', 'minutes', 'label', 'task', 'note']
const quote = (cell: string): string =>
  /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell

/** What to type in the task column for each task: its title, with its due date when another task has the same title, and #n when both match. */
export function taskNames(tasks: readonly SheetTask[]): Map<string, string> {
  const names = new Map<string, string>()
  const byTitle = new Map<string, SheetTask[]>()
  for (const t of tasks) byTitle.set(t.title.trim(), [...(byTitle.get(t.title.trim()) ?? []), t])
  for (const [title, group] of byTitle) {
    if (group.length === 1) {
      names.set(group[0].uid, title)
      continue
    }
    const seen = new Map<string, number>()
    for (const t of group) {
      const base = `${title} (due ${t.date})`
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      names.set(t.uid, n === 1 ? base : `${base} #${n}`)
    }
    // A name that is unique by date alone needs no number: only later duplicates carry one.
  }
  return names
}

/** The pre-filled rows: exact sets first, then the flow's placements, then what is still open, each with a suggestion. */
export function buildRows(
  entries: readonly SheetEntry[],
  tasks: readonly SheetTask[],
  exact: readonly Link[],
  flow: readonly Allocation[],
  names: ReadonlyMap<string, string>
): Row[] {
  const similarity = makeSimilarity([...entries.map((e) => e.label), ...tasks.map((t) => t.title)])
  const rows: Row[] = []
  const placed = new Map<string, number>()
  const place = (e: SheetEntry, minutes: number, task: string, note: string): void => {
    rows.push({ id: e.key, date: e.date, client: e.client, minutes, label: e.label, task, note })
    placed.set(e.key, (placed.get(e.key) ?? 0) + minutes)
  }
  const byKey = new Map(entries.map((e) => [e.key, e]))
  const used = new Map<string, number>()
  for (const l of exact)
    for (const e of l.entries) {
      place(
        byKey.get(e.key) as SheetEntry,
        e.minutes,
        names.get(l.task.uid) as string,
        `sums exactly (${l.confidence})`
      )
      used.set(l.task.uid, (used.get(l.task.uid) ?? 0) + e.minutes)
    }
  for (const a of flow) {
    place(
      byKey.get(a.entry.key) as SheetEntry,
      a.minutes,
      names.get(a.task.uid) as string,
      'best fit, check'
    )
    used.set(a.task.uid, (used.get(a.task.uid) ?? 0) + a.minutes)
  }
  for (const e of entries) {
    const rest = e.minutes - (placed.get(e.key) ?? 0)
    if (rest <= 0) continue
    const maybe = tasks
      .filter((t) => t.minutes - (used.get(t.uid) ?? 0) > 0)
      .map((t) => ({
        t,
        v: similarity(t.title, e.label) - Math.abs(dayNumber(t.date) - dayNumber(e.date)) / 400
      }))
      .filter((x) => x.v > 0.15)
      .sort((a, b) => b.v - a.v)
      .slice(0, 2)
      .map(
        (x) => `${names.get(x.t.uid)} (${formatHours(x.t.minutes - (used.get(x.t.uid) ?? 0))} left)`
      )
    rows.push({
      id: e.key,
      date: e.date,
      client: e.client,
      minutes: rest,
      label: e.label,
      task: '',
      note: maybe.length > 0 ? `maybe: ${maybe.join('; ')}` : 'no candidate'
    })
  }
  return rows.sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id) || a.minutes - b.minutes
  )
}

export function formatWorksheet(rows: readonly Row[]): string {
  const lines = [COLUMNS.join(',')]
  for (const r of rows)
    lines.push(
      [r.id, r.date, r.client, formatHours(r.minutes), String(r.minutes), r.label, r.task, r.note]
        .map(quote)
        .join(',')
    )
  return `${lines.join('\n')}\n`
}

/** The billable tasks with time, for the user to look names up (the same names the task column takes). */
export function formatTaskList(
  tasks: readonly SheetTask[],
  names: ReadonlyMap<string, string>
): string {
  const lines = [['task', 'list', 'sublist', 'due', 'hours', 'minutes'].join(',')]
  for (const t of [...tasks].sort((a, b) => a.date.localeCompare(b.date)))
    lines.push(
      [
        names.get(t.uid) as string,
        t.list,
        t.sublist,
        t.date,
        formatHours(t.minutes),
        String(t.minutes)
      ]
        .map(quote)
        .join(',')
    )
  return `${lines.join('\n')}\n`
}

export interface ParsedRow {
  id: string
  minutes: number
  task: string
  line: number
}

export function parseWorksheet(text: string): { rows: ParsedRow[]; problems: string[] } {
  const table = parseCsv(text)
  const problems: string[] = []
  const head = table[0] ?? []
  const col = (name: string): number => head.indexOf(name)
  const [id, minutes, task] = [col('id'), col('minutes'), col('task')]
  if (id < 0 || minutes < 0 || task < 0)
    return { rows: [], problems: ['The sheet needs the columns id, minutes and task.'] }
  const rows: ParsedRow[] = []
  table.slice(1).forEach((cells, i) => {
    if (cells.every((c) => c.trim() === '')) return
    const m = Number(cells[minutes])
    if (!cells[id] || !Number.isInteger(m) || m <= 0 || m % 15 !== 0) {
      problems.push(`Line ${i + 2}: the minutes must be a whole number of quarter hours.`)
      return
    }
    rows.push({ id: cells[id].trim(), minutes: m, task: (cells[task] ?? '').trim(), line: i + 2 })
  })
  return { rows, problems }
}

export interface NewTask {
  title: string
  sublist: string
  minutes: number
  entries: string[]
}

export interface Check {
  problems: string[]
  /** Billable tasks with ClickUp time, and what the sheet gives them. */
  tasks: { task: SheetTask; name: string; assigned: number; fit: 'exact' | 'short' | 'over' }[]
  /** Entries with no task in the sheet, in minutes. */
  unassigned: { id: string; minutes: number }[]
  noTask: { id: string; minutes: number }[]
  newTasks: NewTask[]
  notBillable: { id: string; task: string; minutes: number }[]
  /** True when everything adds up: every entry accounted for and every billable task's time met exactly. */
  complete: boolean
}

/** `NEW: Title [Sublist]` -> the title and sublist; null when the cell is not a new task. */
export function parseNewTask(cell: string): { title: string; sublist: string } | null {
  const m = /^NEW:\s*(.+?)\s*(?:\[(.+)\])?\s*$/i.exec(cell)
  return m ? { title: m[1].trim(), sublist: (m[2] ?? '').trim() } : null
}

export function checkWorksheet(
  parsed: { rows: ParsedRow[]; problems: string[] },
  entries: readonly SheetEntry[],
  tasks: readonly SheetTask[],
  allTaskNames: ReadonlyMap<string, string>,
  billableUids: ReadonlySet<string>
): Check {
  const problems = [...parsed.problems]
  const byName = new Map([...allTaskNames].map(([uid, name]) => [name.toLowerCase(), uid]))
  const given = new Map<string, number>()
  const assigned = new Map<string, number>()
  const unassigned: Check['unassigned'] = []
  const noTask: Check['noTask'] = []
  const newTasks = new Map<string, NewTask>()
  const notBillable: Check['notBillable'] = []
  const known = new Set(entries.map((e) => e.key))
  for (const r of parsed.rows) {
    if (!known.has(r.id)) {
      problems.push(`Line ${r.line}: no entry "${r.id}".`)
      continue
    }
    given.set(r.id, (given.get(r.id) ?? 0) + r.minutes)
    if (r.task === '') unassigned.push({ id: r.id, minutes: r.minutes })
    else if (r.task === '-') noTask.push({ id: r.id, minutes: r.minutes })
    else if (parseNewTask(r.task)) {
      const n = parseNewTask(r.task) as { title: string; sublist: string }
      const k = `${n.title.toLowerCase()}|${n.sublist.toLowerCase()}`
      const cur = newTasks.get(k) ?? { ...n, minutes: 0, entries: [] }
      cur.minutes += r.minutes
      cur.entries.push(r.id)
      newTasks.set(k, cur)
    } else {
      const uid = byName.get(r.task.toLowerCase())
      if (!uid) problems.push(`Line ${r.line}: no task called "${r.task}".`)
      else if (!billableUids.has(uid))
        notBillable.push({ id: r.id, task: r.task, minutes: r.minutes })
      else assigned.set(uid, (assigned.get(uid) ?? 0) + r.minutes)
    }
  }
  for (const e of entries) {
    const g = given.get(e.key) ?? 0
    if (g === 0) unassigned.push({ id: e.key, minutes: e.minutes })
    else if (g !== e.minutes)
      problems.push(
        `Entry ${e.key}: its rows add up to ${formatHours(g)}, the entry is ${formatHours(e.minutes)}.`
      )
  }
  const rows = tasks
    .filter((t) => billableUids.has(t.uid) && t.minutes > 0)
    .map((task) => {
      const a = assigned.get(task.uid) ?? 0
      return {
        task,
        name: allTaskNames.get(task.uid) as string,
        assigned: a,
        fit: (a === task.minutes ? 'exact' : a < task.minutes ? 'short' : 'over') as
          'exact' | 'short' | 'over'
      }
    })
  const complete =
    problems.length === 0 &&
    unassigned.length === 0 &&
    notBillable.length === 0 &&
    rows.every((r) => r.fit === 'exact')
  return {
    problems,
    tasks: rows,
    unassigned,
    noTask,
    newTasks: [...newTasks.values()],
    notBillable,
    complete
  }
}
