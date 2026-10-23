import type { Task, TaskChanges } from './types'

/** The meeting or training whose note made a task, for the "Made by" line on a locked task. */
export interface SessionSource {
  kind: 'meeting' | 'training'
  workspace: string
  id: string
  title: string
  /** Set for a series task: the series the meetings or trainings under it belong to (empty when they have none). */
  series?: string
}

/**
 * How the app holds a task fixed (the user's rule, 23 Oct 2026). `session`: a task the app made for a meeting or training (its
 * `ownKind` is set): its note says when it happened, so title, list, due date, status, repeat and delete are the note's and the
 * sweep's. `series`: the top-level task such sessions sit under: title, list, repeat, delete, due date and status are locked too
 * (revised 23 Oct 2026: its due date is the latest of its subtasks' and it is done once they all are, `seriesChanges`). Priority,
 * tags, notes and time stay free.
 */
export type SessionLock = 'session' | 'series'

/** The lock a task is under, given its open subtasks (only a top-level task can be a series). Null for any other task. */
export function sessionLock(task: Task, kids: readonly Task[]): SessionLock | null {
  if (task.ownKind) return 'session'
  if (!task.parentUid && kids.some((k) => k.ownKind)) return 'series'
  return null
}

/** The lock of `task` among `tasks` (a workspace's whole list). */
export function sessionLockIn(task: Task, tasks: readonly Task[]): SessionLock | null {
  if (task.ownKind) return 'session'
  if (task.parentUid) return null
  return sessionLock(
    task,
    tasks.filter((t) => t.parentUid === task.uid)
  )
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
