import type { Task } from './types'

/** The list a task made from Hours goes to: where the user last added one, else the first list there is. */
export function listForNewTask(
  tasks: readonly Pick<Task, 'list' | 'parentUid'>[],
  last: string
): string {
  if (last) return last
  return tasks.find((t) => t.parentUid === null && t.list)?.list ?? ''
}
