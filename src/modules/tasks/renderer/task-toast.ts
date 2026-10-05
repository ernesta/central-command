import { useSyncExternalStore } from 'react'

/** A short message at the bottom of the window ("Done. The next one is due …"), shown for a few seconds. */
let message = ''
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

export function showTaskToast(text: string, ms = 4000): void {
  message = text
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    message = ''
    timer = null
    listeners.forEach((l) => l())
  }, ms)
  listeners.forEach((l) => l())
}

export function useTaskToast(): string {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => message
  )
}
