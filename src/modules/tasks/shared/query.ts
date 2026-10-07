import { formatDate, formatShortDate } from '@shared/time'
import { fold } from '@shared/text'
import { TASK_PRIORITIES, type TaskPriority } from './types'
import { compareRows, effectiveDue, inView, taskTime, type TaskRow, type TaskView } from './views'

/** The separator inside a remembered "list and sublist" value; no list name can hold it. */
const LIST_SEP = '\u0001'

export type SortKey = 'default' | 'status' | 'title' | 'list' | 'priority' | 'time' | 'due'

export interface TasksQuery {
  search: string
  /** '' for all lists; a list, or a list and sublist joined by `LIST_SEP`. */
  list: string
  priority: 'all' | TaskPriority
  /** '' for any tag. */
  tag: string
  view: TaskView
  sort: SortKey
  /** `asc` or `desc` for the chosen column; ignored while `sort` is `default`. */
  dir: 'asc' | 'desc'
}

export const DEFAULT_TASKS_QUERY: TasksQuery = {
  search: '',
  list: '',
  priority: 'all',
  tag: '',
  view: 'open',
  sort: 'default',
  dir: 'asc'
}

const SORT_KEYS: readonly SortKey[] = [
  'default',
  'status',
  'title',
  'list',
  'priority',
  'time',
  'due'
]

/** Turn whatever was remembered (possibly hand-edited, or from an older version) into a valid query. */
export function normaliseTasksQuery(raw: unknown): TasksQuery {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const str = (v: unknown): string => (typeof v === 'string' ? v : '')
  return {
    search: str(o.search),
    list: str(o.list),
    priority: (TASK_PRIORITIES as readonly unknown[]).includes(o.priority)
      ? (o.priority as TaskPriority)
      : 'all',
    tag: str(o.tag),
    view: o.view === 'backlog' || o.view === 'done' ? o.view : 'open',
    sort: SORT_KEYS.includes(o.sort as SortKey) ? (o.sort as SortKey) : 'default',
    dir: o.dir === 'desc' ? 'desc' : 'asc'
  }
}

export function listValue(list: string, sublist = ''): string {
  return sublist ? `${list}${LIST_SEP}${sublist}` : list
}

export function parseListValue(value: string): { list: string; sublist: string } {
  const [list = '', sublist = ''] = value.split(LIST_SEP)
  return { list, sublist }
}

/** "Thesis", "Thesis › Methods". */
export function listLabel(list: string, sublist = ''): string {
  return sublist ? `${list} › ${sublist}` : list
}

/** The lists in use, each with its sublists, most used first: the choices of a list filter and of the list field. */
export interface ListChoice {
  list: string
  sublist: string
  count: number
}

export function listChoices(rows: readonly TaskRow[]): ListChoice[] {
  const lists = new Map<string, { count: number; subs: Map<string, number> }>()
  for (const { task } of rows) {
    const entry = lists.get(task.list) ?? { count: 0, subs: new Map() }
    entry.count++
    if (task.sublist) entry.subs.set(task.sublist, (entry.subs.get(task.sublist) ?? 0) + 1)
    lists.set(task.list, entry)
  }
  return [...lists.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([list, { count, subs }]) => [
      { list, sublist: '', count },
      ...[...subs.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([sublist, n]) => ({ list, sublist, count: n }))
    ])
}

/** Every tag in use, alphabetical. */
export function tagsIn(rows: readonly TaskRow[]): string[] {
  const tags = new Set<string>()
  for (const { task, kids } of rows)
    for (const t of [task, ...kids]) for (const g of t.tags) tags.add(g)
  return [...tags].sort((a, b) => a.localeCompare(b))
}

/** A query whose list or tag no longer exists must not hide everything: those parts go back to "all". */
export function reconcileQuery(query: TasksQuery, rows: readonly TaskRow[]): TasksQuery {
  const { list, sublist } = parseListValue(query.list)
  const lists = listChoices(rows)
  const known =
    query.list === '' ||
    lists.some((c) => c.list === list && (sublist === '' || c.sublist === sublist))
  return {
    ...query,
    list: known ? query.list : '',
    tag: query.tag === '' || tagsIn(rows).includes(query.tag) ? query.tag : ''
  }
}

function matchesList(row: TaskRow, value: string): boolean {
  if (value === '') return true
  const { list, sublist } = parseListValue(value)
  return row.task.list === list && (sublist === '' || row.task.sublist === sublist)
}

function haystack(row: TaskRow): string {
  const { task, kids } = row
  return fold(
    [
      task.title,
      ...task.tags,
      listLabel(task.list, task.sublist),
      task.description,
      ...kids.map((k) => k.title)
    ].join('\n')
  )
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 }
const STATUS_RANK = { doing: 0, todo: 1, done: 2 } as const

function compareDone(a: TaskRow, b: TaskRow): number {
  const ca = a.task.completedAt
  const cb = b.task.completedAt
  if (ca !== cb) return ca === null ? 1 : cb === null ? -1 : cb.localeCompare(ca)
  return b.task.createdAt.localeCompare(a.task.createdAt)
}

/** How a column orders two rows, ascending. */
function compareBy(
  key: SortKey,
  tracked: ReadonlyMap<string, number>
): (a: TaskRow, b: TaskRow) => number {
  const text = (a: string, b: string): number => a.localeCompare(b)
  switch (key) {
    case 'status':
      return (a, b) => STATUS_RANK[a.task.status] - STATUS_RANK[b.task.status]
    case 'title':
      return (a, b) => text(a.task.title, b.task.title)
    case 'list':
      return (a, b) =>
        text(listLabel(a.task.list, a.task.sublist), listLabel(b.task.list, b.task.sublist))
    case 'priority':
      return (a, b) => PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority]
    case 'time':
      return (a, b) => taskTime(a, tracked).total - taskTime(b, tracked).total
    case 'due':
      return (a, b) => {
        const da = effectiveDue(a.task, a.kids)
        const db = effectiveDue(b.task, b.kids)
        return da === db ? 0 : da === null ? 1 : db === null ? -1 : da.localeCompare(db)
      }
    default:
      return () => 0
  }
}

/**
 * The rows a list shows: the chosen view, the list, priority, tag and every search word, in the view's own order (due
 * soonest first, then High before Low; Done most recently finished first) or the column the person sorted by (ties keep
 * the view's order). A missing value (no date, no time) always sorts last.
 */
export function queryTasks(
  rows: readonly TaskRow[],
  query: TasksQuery,
  tracked: ReadonlyMap<string, number> = new Map()
): TaskRow[] {
  const terms = fold(query.search).split(/\s+/).filter(Boolean)
  const kept = rows
    .filter((r) => inView(r, query.view))
    .filter((r) => matchesList(r, query.list))
    .filter((r) => query.priority === 'all' || r.task.priority === query.priority)
    .filter((r) => query.tag === '' || r.task.tags.includes(query.tag))
    .filter((r) => {
      if (terms.length === 0) return true
      const text = haystack(r)
      return terms.every((t) => text.includes(t))
    })
  const base = query.view === 'done' ? compareDone : compareRows
  const sorted = [...kept].sort(base)
  if (query.sort === 'default') return sorted
  const by = compareBy(query.sort, tracked)
  const sign = query.dir === 'desc' ? -1 : 1
  // The empty ones stay last in both directions.
  const empty = (r: TaskRow): boolean =>
    query.sort === 'due'
      ? effectiveDue(r.task, r.kids) === null
      : query.sort === 'time'
        ? taskTime(r, tracked).total === 0
        : false
  return sorted.sort((a, b) => {
    if (empty(a) !== empty(b)) return empty(a) ? 1 : -1
    return sign * by(a, b)
  })
}

/** How many rows are in each view for the current list, priority, tag and search (the numbers on the segmented control). */
export function viewCounts(rows: readonly TaskRow[], query: TasksQuery): Record<TaskView, number> {
  const counts = { open: 0, backlog: 0, done: 0 }
  for (const view of ['open', 'backlog', 'done'] as const) {
    counts[view] = queryTasks(rows, { ...query, view }).length
  }
  return counts
}

/** A due date as a table shows it: "Today", "Oct 9", "Jan 4, 2027" (the year only when it is not this year). */
export function formatDue(due: string, today: string): string {
  if (due === today) return 'Today'
  return due.slice(0, 4) === today.slice(0, 4) ? formatShortDate(due) : formatDate(due)
}

export type DueTone = 'overdue' | 'today' | 'normal'

export function dueTone(due: string, today: string): DueTone {
  return due < today ? 'overdue' : due === today ? 'today' : 'normal'
}

/** Minutes as the table shows them: "3:45", and nothing for none. */
export function formatTaskTime(minutes: number): string {
  if (minutes <= 0) return ''
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

/** The list a new task goes in when the person has not said: the list being looked at, else the last one used, else the busiest. */
export function defaultList(
  rows: readonly TaskRow[],
  options: { filter?: string; last?: { list: string; sublist: string } }
): { list: string; sublist: string } {
  const exists = (list: string, sublist: string): boolean =>
    listChoices(rows).some((c) => c.list === list && (sublist === '' || c.sublist === sublist))
  if (options.filter) {
    const { list, sublist } = parseListValue(options.filter)
    if (exists(list, sublist)) return { list, sublist }
  }
  const last = options.last
  if (last && last.list && exists(last.list, last.sublist)) return last
  const busiest = [...rows]
    .filter((r) => r.task.status !== 'done')
    .reduce((m, r) => m.set(r.task.list, (m.get(r.task.list) ?? 0) + 1), new Map<string, number>())
  const top = [...busiest.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  return { list: top ? top[0] : 'General', sublist: '' }
}
