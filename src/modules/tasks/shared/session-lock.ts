import type { Task, TaskChanges } from './types'

/**
 * The training whose note made a self-study task (or the series task over such tasks), for the "Made by" line on a locked task. Meeting
 * and training tasks are never shown (28 Oct 2026), so nothing links to them.
 */
export interface SessionSource {
  kind: 'training'
  workspace: string
  id: string
  title: string
  /** Set for a series task: the series the trainings under it belong to (empty when they have none). */
  series?: string
}

/**
 * How the app holds a task fixed (the user's rule, 23 Oct 2026). `session`: a self-study task (`ownKind` `self-study`): its training
 * says when it happened, so title, list, due date, status, repeat and delete are the note's and the sweep's. A meeting's or
 * training's own task is never shown (28 Oct 2026), so no one can edit it and it has no lock of its own. `series`: the top-level task such sessions sit under: title, list, repeat, delete, due date and status are locked too
 * (revised 23 Oct 2026: its due date is the latest of its subtasks' and it is done once they all are, `seriesChanges`). Priority,
 * tags, notes and time stay free.
 */
export type SessionLock = 'session' | 'series'

/** The lock a task is under, given its open subtasks (only a top-level task can be a series). Null for any other task. */
export function sessionLock(task: Task, kids: readonly Task[]): SessionLock | null {
  if (task.ownKind === 'self-study') return 'session'
  if (!task.parentUid && kids.some((k) => k.ownKind)) return 'series'
  return null
}

/** The lock of `task` among `tasks` (a workspace's whole list). */
export function sessionLockIn(task: Task, tasks: readonly Task[]): SessionLock | null {
  if (task.ownKind === 'self-study') return 'session'
  if (task.parentUid) return null
  return sessionLock(
    task,
    tasks.filter((t) => t.parentUid === task.uid)
  )
}

/**
 * The top-level tasks with a session subtask (a meeting's, training's or self-study): the series tasks. A visible series task may have
 * session subtasks no view shows, so the views' own rows can miss them; this reads the whole list.
 */
export function seriesUids(tasks: readonly Task[]): Set<string> {
  const series = new Set<string>()
  const top = new Set(tasks.filter((t) => !t.parentUid).map((t) => t.uid))
  for (const t of tasks) {
    if (t.ownKind && t.parentUid && top.has(t.parentUid)) series.add(t.parentUid)
  }
  return series
}

/** The lock of a task a view shows: `sessionLock` of its shown subtasks, or a series lock when `series` (`seriesUids` of every task) has it. */
export function lockOf(
  task: Task,
  kids: readonly Task[],
  series: ReadonlySet<string>
): SessionLock | null {
  return sessionLock(task, kids) ?? (!task.parentUid && series.has(task.uid) ? 'series' : null)
}

/**
 * The tasks no task view shows (the user's rule, 24 Oct 2026): a meeting's own task and a training's own session task, which are
 * kept as records (every hour has a task, the notes' hours come from them, Work's totals depend on them) but are shown as the
 * meeting or training, not as a task; and the plain series task whose every subtask is one of those. Self-study tasks stay
 * visible, and so does a series task with any subtask the user made. Nothing about storage, hours or deletion changes.
 */
export function hiddenTaskUids(tasks: readonly Task[]): Set<string> {
  const isSession = (t: Task): boolean => t.ownKind === 'meeting' || t.ownKind === 'training'
  const hidden = new Set(tasks.filter(isSession).map((t) => t.uid))
  const kids = new Map<string, Task[]>()
  for (const t of tasks) {
    if (t.parentUid) kids.set(t.parentUid, [...(kids.get(t.parentUid) ?? []), t])
  }
  for (const t of tasks) {
    const under = kids.get(t.uid)
    if (!t.parentUid && !t.ownKind && under && under.every(isSession)) hidden.add(t.uid)
  }
  return hidden
}

/**
 * The series tasks over self-study tasks ("<series> self-study"): a container whose due date and status come from its subtasks. Task
 * views keep them (time can be put on one), but Home shows only the subtasks, each named as its training (the user's choice, 26 Oct 2026).
 */
export function studySeriesUids(tasks: readonly Task[]): Set<string> {
  const byUid = new Map(tasks.map((t) => [t.uid, t]))
  const series = new Set<string>()
  for (const t of tasks) {
    const parent = t.ownKind === 'self-study' && t.parentUid ? byUid.get(t.parentUid) : undefined
    if (parent && !parent.parentUid && !parent.ownKind) series.add(parent.uid)
  }
  return series
}

/** `trash` (`{ task }` rows, subtasks included) without the hidden tasks: Settings' Deleted tasks never lists a meeting's or training's own task. */
export function visibleTrash<T extends { task: Task }>(trash: readonly T[]): T[] {
  const hidden = hiddenTaskUids(trash.map((r) => r.task))
  return trash.filter((r) => !hidden.has(r.task.uid))
}

/** `tasks` without the hidden ones (`hiddenTaskUids`): the list every task view is built from. */
export function visibleTasks<T extends Task>(tasks: readonly T[]): T[] {
  const hidden = hiddenTaskUids(tasks)
  return hidden.size === 0 ? [...tasks] : tasks.filter((t) => !hidden.has(t.uid))
}

/** Whether a field of a task in this lock is the note's (or the sweep's), not the user's. */
export function fieldLocked(
  lock: SessionLock | null,
  field: 'status' | keyof TaskChanges
): boolean {
  if (!lock) return false
  return (
    field === 'status' ||
    field === 'title' ||
    field === 'list' ||
    field === 'sublist' ||
    field === 'recurrence' ||
    field === 'due'
  )
}

/** The names of the locked fields `changes` would actually change on `task` (a value equal to the current one changes nothing). */
export function lockedChanges(
  task: Task,
  lock: SessionLock | null,
  changes: TaskChanges
): (keyof TaskChanges)[] {
  if (!lock) return []
  return (Object.keys(changes) as (keyof TaskChanges)[]).filter((key) => {
    if (!fieldLocked(lock, key)) return false
    const now = key === 'recurrence' ? JSON.stringify(task.recurrence) : task[key as keyof Task]
    const next = key === 'recurrence' ? JSON.stringify(changes.recurrence) : changes[key]
    return next !== now
  })
}
