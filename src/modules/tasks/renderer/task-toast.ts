import { useSyncExternalStore } from 'react'

export interface TaskToast {
  text: string
  /** A button on the message ("Undo"). */
  action?: { label: string; run: () => void }
}

/** A short message at the bottom of the window ("Done. The next one is due …"), shown for a few seconds. */
let current: TaskToast | null = null
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

export function showTaskToast(text: string, action?: TaskToast['action'], ms = 6000): void {
  current = { text, action }
  if (timer) clearTimeout(timer)
  timer = setTimeout(clearTaskToast, ms)
  listeners.forEach((l) => l())
}

export function clearTaskToast(): void {
  current = null
  if (timer) clearTimeout(timer)
  timer = null
  listeners.forEach((l) => l())
}

export function useTaskToast(): TaskToast | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current
  )
}
