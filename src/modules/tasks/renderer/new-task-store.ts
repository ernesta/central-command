import { useSyncExternalStore } from 'react'
import type { Task, TaskWorkspace } from '../shared/types'

/** Whether the "New task" dialog is open, and what it was opened with. One dialog for the whole app (see `TaskGlobals`). */
export interface NewTaskRequest {
  /** The workspace to add to, when it is not the one being looked at (the palette and the Dock menu). */
  workspace?: TaskWorkspace
  /** The list being looked at, as a list value (see `listValue`), if any. */
  list?: string
  /** What the dialog starts with, when it is opened from somewhere that knows (a Watch row). Left out: an empty title, due today. */
  title?: string
  /** YYYY-MM-DD, or null for no date; left out, the dialog's own default (today). */
  due?: string | null
  /** Carried to the task as it is made; the dialog has no field for it. */
  description?: string
  /** The Watch item the task is made from: the task keeps its id and address (`docs/WATCH_TASKS_PLAN.md`). */
  watchItem?: { id: number; url: string }
  /** Called once the task exists (not on Cancel), so the caller can do what goes with it. */
  onCreated?: (task: Task) => void
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
