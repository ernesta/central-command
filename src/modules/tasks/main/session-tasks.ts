import type { Database } from 'better-sqlite3'
import { isOwnMeetingTask } from '../../meetings/shared/meeting-task'
import type { Task } from '../shared/types'
import { getTaskAnywhere } from './repository'
import type { TasksStore } from './tasks-store'

/**
 * Puts a meeting's own task in the Tasks trash, because the meeting is gone. Only a task the app made for the meeting (its marker, or
 * the older title it carried before there was one) is ever touched: one the user chose stands for more than the meeting. Returns the
 * task trashed, or null when there was nothing to do.
 */
export function trashOwnMeetingTask(store: TasksStore, uid: string): Task | null {
  const task = store.get(uid)
  if (!task || !isOwnMeetingTask(task)) return null
  store.delete(uid)
  return task
}

/** The Undo of `trashOwnMeetingTask`: brings the meeting's own task back from the trash. Returns it, or null when it was not there. */
export function restoreOwnMeetingTask(db: Database, store: TasksStore, uid: string): Task | null {
  const found = getTaskAnywhere(db, uid)
  if (!found || found.deletedAt === null || !isOwnMeetingTask(found.task)) return null
  try {
    return store.restore(uid)
  } catch {
    // Its series task is in the trash too: nothing to put it under, and the trash still holds it.
    return null
  }
}
