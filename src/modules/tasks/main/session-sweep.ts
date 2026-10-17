import type { Database } from 'better-sqlite3'
import { isOwnMeetingTask } from '../../meetings/shared/meeting-task'
import { TRAINING_LIST } from '../../training/shared/lecture-task'
import { sessionTaskChanges, type LocalMoment, type SessionTimes } from '../shared/session-task'
import type { Task, TaskWorkspace } from '../shared/types'
import type { TasksStore } from './tasks-store'

interface SessionRow extends SessionTimes {
  task: string
  kind: 'meeting' | 'training'
}

function sessionRows(db: Database): SessionRow[] {
  return db
    .prepare(
      `SELECT task, date, end_time AS end, 'meeting' AS kind FROM meetings WHERE task NOT IN ('', 'auto') AND date != ''
       UNION ALL
       SELECT task, date, end_time AS end, 'training' AS kind FROM training WHERE task NOT IN ('', 'auto') AND date != ''`
    )
    .all() as SessionRow[]
}

/**
 * Whether a task is the session's own, one the app made and keeps in step, so the app may date and close it. A task the user
 * chose for a meeting is never touched (it stands for more than one session); a training's is its subtask, or the top-level task
 * in Training with nothing under it.
 */
function isOwn(row: SessionRow, task: Task, hasSubtasks: (uid: string) => boolean): boolean {
  if (row.kind === 'meeting') return isOwnMeetingTask(task)
  if (task.parentUid) return true
  return task.list.toLowerCase() === TRAINING_LIST.toLowerCase() && !hasSubtasks(task.uid)
}

export function localMoment(date = new Date()): LocalMoment {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
}

/**
 * Gives every meeting's and training's own task its session's day as the due date, and marks it done once the session is over.
 * Returns the workspaces whose tasks changed. Run at launch and every minute while the app is open.
 */
export function settleSessionTasks(
  db: Database,
  store: TasksStore,
  now: LocalMoment
): Set<TaskWorkspace> {
  const changed = new Set<TaskWorkspace>()
  const hasSubtasks = (uid: string): boolean =>
    db
      .prepare('SELECT 1 FROM tasks WHERE parent_uid = ? AND deleted_at IS NULL LIMIT 1')
      .get(uid) !== undefined
  for (const row of sessionRows(db)) {
    const task = store.get(row.task)
    if (!task || !isOwn(row, task, hasSubtasks)) continue
    const changes = sessionTaskChanges(task, row, now)
    if (changes.due !== undefined) store.setDue([task.uid], changes.due)
    if (changes.done) store.setStatus(task.uid, 'done')
    if (changes.due !== undefined || changes.done) changed.add(task.workspace)
  }
  return changed
}
