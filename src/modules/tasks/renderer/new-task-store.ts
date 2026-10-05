import { useSyncExternalStore } from 'react'

/** Whether the "New task" dialog is open, and what it was opened with. One dialog for the whole app (see `TaskGlobals`). */
export interface NewTaskRequest {
  /** The list being looked at, as a list value (see `listValue`), if any. */
  list?: string
}

let current: NewTaskRequest | null = null
const listeners = new Set<() => void>()
const emit = (): void => listeners.forEach((l) => l())

export function openNewTask(request: NewTaskRequest = {}): void {
  current = request
  emit()
}

export function closeNewTask(): void {
  current = null
  emit()
}

export function useNewTaskRequest(): NewTaskRequest | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current
  )
}
