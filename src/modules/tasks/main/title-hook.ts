/**
 * Tasks tells Hours when a task is renamed (the app's one tracking store lives in the main process's setup, which
 * Tasks does not reach). Set once at start; without it (tests, scripts) a rename touches only the task.
 */
let onTitleChanged: ((uid: string, title: string) => void) | null = null

export function setTitleChanged(listener: ((uid: string, title: string) => void) | null): void {
  onTitleChanged = listener
}

export function notifyTitleChanged(uid: string, title: string): void {
  onTitleChanged?.(uid, title)
}
