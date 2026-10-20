/**
 * Tasks tells Hours when tasks go to the trash or come back (the app's one tracking store lives in the main process's setup,
 * which Tasks does not reach). Set once at start; without it (tests, scripts) a delete touches only the tasks.
 */
export interface TaskTimeHook {
  /** Take the saved time of these tasks (`cc://task/<uid>` keys) out of Hours, keeping it for a restore. Returns the minutes removed. */
  remove(tasks: string[]): number
  /** Put back what `remove` kept for these tasks. */
  restore(tasks: string[]): void
}

let hook: TaskTimeHook | null = null

export function setTaskTimeHook(next: TaskTimeHook | null): void {
  hook = next
}

export function removeTaskTime(tasks: string[]): number {
  return hook?.remove(tasks) ?? 0
}

export function restoreTaskTime(tasks: string[]): void {
  hook?.restore(tasks)
}
