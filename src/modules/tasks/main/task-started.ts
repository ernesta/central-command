import { taskUidOf } from '../shared/tracked'
import type { Task } from '../shared/types'
import type { TasksStore } from './tasks-store'

/**
 * A timer started on a task (named by the key a session carries, `cc://task/<uid>`) puts it in progress when it is still
 * to do, and sets a missing or past due date to today (a done task stays as it is). Returns the task when it changed,
 * otherwise null (nothing to change, or a key that names no task).
 */
export function putStartedTaskInProgress(store: TasksStore, key: string): Task | null {
  const uid = taskUidOf(key)
  let task = uid ? store.get(uid) : null
  if (!uid || !task) return null
  if (task.status === 'done') return reopenSelfStudyTask(store, key)
  let changed = false
  if (task.status === 'todo') {
    task = store.setStatus(uid, 'doing').task
    changed = true
  }
  if (!task.due || task.due < store.today()) {
    store.setDue([uid], store.today())
    task = store.get(uid) ?? task
    changed = true
  }
  return changed ? task : null
}

/**
 * Time put on a self-study task (a timer started, or time added) reopens it when it is done: the week after the training is only when
 * the app closes it, not a lock. Other done tasks stay as they are. Returns the task when it was reopened.
 */
export function reopenSelfStudyTask(store: TasksStore, key: string): Task | null {
  const uid = taskUidOf(key)
  const task = uid ? store.get(uid) : null
  if (!uid || !task || task.status !== 'done' || task.ownKind !== 'self-study') return null
  return store.setStatus(uid, 'doing').task
}
