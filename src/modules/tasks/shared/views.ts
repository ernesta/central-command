import { addDays } from '@shared/year'
import type { Task, TaskPriority } from './types'

/** A top-level task with its subtasks, in their order. Only these are rows in any table. */
export interface TaskRow {
  task: Task
  kids: Task[]
}

/** How many days ahead Upcoming looks. */
export const UPCOMING_DAYS = 14

const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 }

/** Subtasks in the order the user keeps them: by position, then by when they were added. */
export function orderSubtasks(kids: readonly Task[]): Task[] {
  return [...kids].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
}

/** Top-level tasks, each with its subtasks. A subtask whose parent is missing is left out (it cannot be a row). */
export function groupTasks(all: readonly Task[]): TaskRow[] {
  const kids = new Map<string, Task[]>()
  for (const t of all) {
    if (t.parentUid) kids.set(t.parentUid, [...(kids.get(t.parentUid) ?? []), t])
  }
  return all
    .filter((t) => !t.parentUid)
    .map((task) => ({ task, kids: orderSubtasks(kids.get(task.uid) ?? []) }))
}

/**
 * The date a task shows: its own; a task with none and dated open subtasks takes the earliest of theirs. The task's own
 * date is never replaced by a subtask's.
 */
export function effectiveDue(task: Task, kids: readonly Task[]): string | null {
  if (task.due) return task.due
  const dates = kids.filter((k) => k.status !== 'done' && k.due).map((k) => k.due as string)
  return dates.length > 0 ? dates.sort()[0] : null
}

/** Open: dated or in progress, and not done. */
export function isOpen({ task, kids }: TaskRow): boolean {
  return task.status !== 'done' && (task.status === 'doing' || effectiveDue(task, kids) !== null)
}

/** Backlog / Someday: still to do, with no date (kept out of Today). */
export function isBacklog({ task, kids }: TaskRow): boolean {
  return task.status === 'todo' && effectiveDue(task, kids) === null
}

export function isDone({ task }: TaskRow): boolean {
  return task.status === 'done'
}

export type TaskView = 'open' | 'backlog' | 'done'

export function inView(row: TaskRow, view: TaskView): boolean {
  return view === 'open' ? isOpen(row) : view === 'backlog' ? isBacklog(row) : isDone(row)
}

/** Due soonest first (no date last), then High before Low, then by title. */
export function compareRows(a: TaskRow, b: TaskRow): number {
  const da = effectiveDue(a.task, a.kids)
  const db = effectiveDue(b.task, b.kids)
  if (da !== db) return da === null ? 1 : db === null ? -1 : da.localeCompare(db)
  return (
    PRIORITY_ORDER[a.task.priority] - PRIORITY_ORDER[b.task.priority] ||
    a.task.title.localeCompare(b.task.title)
  )
}

export const LANDING_SECTIONS = ['today', 'doing', 'overdue', 'upcoming'] as const
export type LandingSection = (typeof LANDING_SECTIONS)[number]

/** A row in a landing section, with the subtasks that put it there (those with their own date), shown under it. */
export interface SectionRow extends TaskRow {
  nested: Task[]
}

function dateMatches(section: LandingSection, date: string | null, today: string): boolean {
  if (!date) return false
  if (section === 'today') return date === today
  if (section === 'overdue') return date < today
  if (section === 'upcoming') return date > today && date <= addDays(today, UPCOMING_DAYS)
  return false
}

/**
 * Today's sections. A task appears once, under the first heading that fits, in the order Due today, In progress,
 * Overdue, Upcoming. It fits by its own date or status, or because an open subtask of it has its own date that fits
 * (then it appears with that subtask nested under it). Done tasks are never listed.
 */
export function landingSections(
  rows: readonly TaskRow[],
  today: string
): Record<LandingSection, SectionRow[]> {
  const out: Record<LandingSection, SectionRow[]> = {
    today: [],
    doing: [],
    overdue: [],
    upcoming: []
  }
  for (const row of rows) {
    if (row.task.status === 'done') continue
    const dated = row.kids.filter((k) => k.status !== 'done' && k.due)
    for (const section of LANDING_SECTIONS) {
      const own =
        section === 'doing'
          ? row.task.status === 'doing'
          : dateMatches(section, row.task.due, today)
      const nested = dated.filter((k) => dateMatches(section, k.due, today))
      if (own || nested.length > 0) {
        out[section].push({ ...row, nested })
        break
      }
    }
  }
  for (const section of LANDING_SECTIONS) out[section].sort(compareRows)
  return out
}

/** A list as a card: how many top-level tasks are not done, how many of those are overdue, and the sublists in use. */
export interface ListSummary {
  list: string
  open: number
  overdue: number
  sublists: string[]
}

export function listSummaries(rows: readonly TaskRow[], today: string): ListSummary[] {
  const byList = new Map<string, ListSummary>()
  for (const row of rows) {
    if (row.task.status === 'done') continue
    const summary = byList.get(row.task.list) ?? {
      list: row.task.list,
      open: 0,
      overdue: 0,
      sublists: []
    }
    summary.open += 1
    const due = effectiveDue(row.task, row.kids)
    if (due !== null && due < today) summary.overdue += 1
    if (row.task.sublist && !summary.sublists.includes(row.task.sublist)) {
      summary.sublists.push(row.task.sublist)
    }
    byList.set(row.task.list, summary)
  }
  return [...byList.values()]
    .map((s) => ({ ...s, sublists: s.sublists.sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => b.open - a.open || a.list.localeCompare(b.list))
}

/** A task's time in minutes, split into what came from ClickUp and what Hours holds, subtasks rolled up into the task. */
export interface TaskTime {
  earlier: number
  tracked: number
  total: number
}

/** `tracked` maps a task uid to the minutes of Hours sessions that name it. */
export function taskTime(row: TaskRow, tracked: ReadonlyMap<string, number>): TaskTime {
  const all = [row.task, ...row.kids]
  const earlier = all.reduce((sum, t) => sum + t.earlierMinutes, 0)
  const inHours = all.reduce((sum, t) => sum + (tracked.get(t.uid) ?? 0), 0)
  return { earlier, tracked: inHours, total: earlier + inHours }
}

/** Subtasks done and in all, for the pill on the task. */
export function subtaskProgress(kids: readonly Task[]): { done: number; total: number } {
  return { done: kids.filter((k) => k.status === 'done').length, total: kids.length }
}
