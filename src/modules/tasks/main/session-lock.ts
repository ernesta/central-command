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
 * The training whose note made this self-study task, or null (a meeting's or training's own task is never shown, so has no source).
 * For a series task over self-study tasks it is one of those trainings, with the name of their series in `series`, so the page can
 * link to the series.
 */
export function sessionSource(db: Database, uid: string): SessionSource | null {
  return ownSource(db, uid) ?? seriesSource(db, uid)
}

function ownSource(db: Database, uid: string): SessionSource | null {
  const training = db
    .prepare(
      `SELECT workspace, entry_id AS id, title FROM training WHERE self_study_task = ? LIMIT 1`
    )
    .get(uid) as { workspace: string; id: string; title: string } | undefined
  if (!training) return null
  return {
    kind: 'training',
    workspace: training.workspace,
    id: training.id,
    title: training.title || training.id
  }
}

function seriesSource(db: Database, uid: string): SessionSource | null {
  const kids = db
    .prepare(
      `SELECT uid FROM tasks WHERE parent_uid = ? AND deleted_at IS NULL AND own_kind = 'self-study'`
    )
    .all(uid) as { uid: string }[]
  for (const kid of kids) {
    const source = ownSource(db, kid.uid)
    if (!source) continue
    const row = db
      .prepare('SELECT series FROM training WHERE workspace = ? AND entry_id = ?')
      .get(source.workspace, source.id) as { series: string | null } | undefined
    return { ...source, series: row?.series ?? '' }
  }
  return null
}
