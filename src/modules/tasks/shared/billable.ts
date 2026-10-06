import type { Task } from './types'

export const BILLABLE_TAG = 'billable'

/**
 * The billable tasks among `tasks`: those tagged billable and the subtasks of one (ClickUp tagged the parent, and a subtask's
 * time is invoiced with it). Work's Hours offers only these; Research has no notion of billable.
 */
export function billableTasks<T extends Pick<Task, 'uid' | 'parentUid' | 'tags'>>(
  tasks: readonly T[],
  all: readonly Pick<Task, 'uid' | 'tags'>[] = tasks
): T[] {
  const tagged = new Set(all.filter((t) => t.tags.includes(BILLABLE_TAG)).map((t) => t.uid))
  return tasks.filter((t) => tagged.has(t.uid) || (t.parentUid !== null && tagged.has(t.parentUid)))
}
