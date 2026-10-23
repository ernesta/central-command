import type { Database } from 'better-sqlite3'
import {
  lockedChanges,
  sessionLock,
  type SessionLock,
  type SessionSource
} from '../shared/session-lock'
import type { TaskChanges } from '../shared/types'
import { listSubtasks } from './repository'
import type { TasksStore } from './tasks-store'

/** The lock `uid` is under (null: free, or no such task). */
export function lockOfUid(db: Database, store: TasksStore, uid: string): SessionLock | null {
  const task = store.get(uid)
  return task ? sessionLock(task, task.parentUid ? [] : listSubtasks(db, uid)) : null
}

const WHY: Record<SessionLock, string> = {
  session: 'This task is kept by its meeting or training. Change it in the note.',
  series:
    'This task holds meeting or training tasks. Its date and status follow them; its title, list and repeat are fixed.'
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
  const lock = lockOfUid(db, store, uid)
  if (lock) throw new Error(WHY[lock])
}

export function guardDelete(db: Database, store: TasksStore, uid: string): void {
  const lock = lockOfUid(db, store, uid)
  if (lock) throw new Error(WHY[lock])
}

/** `uids` without the session tasks and the series tasks (their dates are not the user's to set). */
export function unlockedForDue(db: Database, store: TasksStore, uids: readonly string[]): string[] {
  return uids.filter((uid) => lockOfUid(db, store, uid) === null)
}

/**
 * The meeting or training whose note made this task, or null. For a series task (what such sessions sit under) it is one of its
 * sessions, with the name of their series in `series`, so the page can link to the series.
 */
export function sessionSource(db: Database, uid: string): SessionSource | null {
  return ownSource(db, uid) ?? seriesSource(db, uid)
}

function ownSource(db: Database, uid: string): SessionSource | null {
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

function seriesSource(db: Database, uid: string): SessionSource | null {
  const kids = db
    .prepare(
      'SELECT uid FROM tasks WHERE parent_uid = ? AND deleted_at IS NULL AND own_kind IS NOT NULL'
    )
    .all(uid) as { uid: string }[]
  for (const kid of kids) {
    const source = ownSource(db, kid.uid)
    if (!source) continue
    const table = source.kind === 'meeting' ? 'meetings' : 'training'
    const idColumn = source.kind === 'meeting' ? 'meeting_id' : 'entry_id'
    const row = db
      .prepare(`SELECT series FROM ${table} WHERE workspace = ? AND ${idColumn} = ?`)
      .get(source.workspace, source.id) as { series: string | null } | undefined
    return { ...source, series: row?.series ?? '' }
  }
  return null
}
