import type { Database } from 'better-sqlite3'
import {
  lockedChanges,
  sessionLock,
  type SessionLock,
  type SessionSource
} from '../shared/session-lock'
import type { Task, TaskChanges } from '../shared/types'
import { listSubtasks } from './repository'
import type { TasksStore } from './tasks-store'

/** The lock `uid` is under (null: free, or no such task). */
export function lockOfUid(db: Database, store: TasksStore, uid: string): SessionLock | null {
  const task = store.get(uid)
  return task ? sessionLock(task, task.parentUid ? [] : listSubtasks(db, uid)) : null
}

const WHY: Record<SessionLock, string> = {
  session: 'This task is kept by its meeting or training. Change it in the note.',
  series: 'This task holds meeting or training tasks. Its title, list, date and repeat are fixed.'
}

/**
 * Refuses a change by the user to what the note owns (a session task's title, list, due date, status and repeat; a series task's
 * title, list, repeat, and a due date). Only the user's IPC calls go through this: the sweep and the notes' own sync call the store.
 */
export function guardUpdate(
  db: Database,
  store: TasksStore,
  uid: string,
  changes: TaskChanges
): void {
  const task = store.get(uid)
  if (!task) return
  const lock = lockOfUid(db, store, uid)
  if (lockedChanges(task, lock, changes).length > 0) throw new Error(WHY[lock as SessionLock])
}

export function guardStatus(db: Database, store: TasksStore, uid: string): void {
  if (lockOfUid(db, store, uid) === 'session') throw new Error(WHY.session)
}

export function guardDelete(db: Database, store: TasksStore, uid: string): void {
  const lock = lockOfUid(db, store, uid)
  if (lock) throw new Error(WHY[lock])
}

/** `uids` without the session tasks and the series tasks (their dates are not the user's to set). */
export function unlockedForDue(db: Database, store: TasksStore, uids: readonly string[]): string[] {
  return uids.filter((uid) => lockOfUid(db, store, uid) === null)
}

/** The meeting or training whose note made this task, or null. */
export function sessionSource(db: Database, uid: string): SessionSource | null {
  const meeting = db
    .prepare(
      `SELECT workspace, meeting_id AS id, series, date FROM meetings WHERE task = ? LIMIT 1`
    )
    .get(uid) as { workspace: string; id: string; series: string; date: string } | undefined
  if (meeting) {
    return {
      kind: 'meeting',
      workspace: meeting.workspace,
      id: meeting.id,
      title: meeting.series || meeting.date || meeting.id
    }
  }
  const training = db
    .prepare(
      `SELECT workspace, entry_id AS id, title FROM training WHERE task = @uid OR self_study_task = @uid LIMIT 1`
    )
    .get({ uid }) as { workspace: string; id: string; title: string } | undefined
  if (training) {
    return {
      kind: 'training',
      workspace: training.workspace,
      id: training.id,
      title: training.title || training.id
    }
  }
  return null
}

/** A series task that has a due date: the sweep takes it away (its subtasks carry the real dates). */
export function seriesWithDates(db: Database, tasks: readonly Task[]): Task[] {
  return tasks.filter(
    (t) => !t.parentUid && t.due !== null && sessionLock(t, listSubtasks(db, t.uid)) === 'series'
  )
}
