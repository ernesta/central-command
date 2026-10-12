import { taskUidOf } from '../shared/tracked'
import type { Task } from '../shared/types'
import type { TasksStore } from './tasks-store'

/**
 * A timer started on a task (named by the key a session carries, `cc://task/<uid>`) puts it in progress when it is still
 * to do. Returns the task when it changed, otherwise null (a done or already running task, or a key that names no task).
 */
export function putStartedTaskInProgress(store: TasksStore, key: string): Task | null {
  const uid = taskUidOf(key)
  const task = uid ? store.get(uid) : null
  if (!uid || !task || task.status !== 'todo') return null
  return store.setStatus(uid, 'doing').task
}
