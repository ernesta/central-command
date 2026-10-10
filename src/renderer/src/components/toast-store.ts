import { useSyncExternalStore } from 'react'

export interface AppToast {
  text: string
  /** A button on the message ("Undo"). */
  action?: { label: string; run: () => void }
}

/** A short message at the bottom of the window ("Deleted "X". Undo"), shown for a few seconds. One for the whole app. */
let current: AppToast | null = null
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

export function showToast(text: string, action?: AppToast['action'], ms = 6000): void {
  current = { text, action }
  if (timer) clearTimeout(timer)
  timer = setTimeout(clearToast, ms)
  listeners.forEach((l) => l())
}

export function clearToast(): void {
  current = null
  if (timer) clearTimeout(timer)
  timer = null
  listeners.forEach((l) => l())
}

export function useToast(): AppToast | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current
  )
}
