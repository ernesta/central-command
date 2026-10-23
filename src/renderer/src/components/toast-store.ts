import { useSyncExternalStore } from 'react'

export interface AppToast {
  text: string
  /** A button on the message ("Undo"). */
  action?: { label: string; run: () => void }
  /** How long it stays, for the time bar. */
  ms: number
  /** Changes with every message. */
  id: number
}

/** How long a message stays: longer when it has a button to reach, so there is time to move the pointer there. */
export const TOAST_MS = 9000
export const TOAST_ACTION_MS = 12000

/** A short message at the bottom of the window ("Deleted "X". Undo"). One for the whole app. */
let current: AppToast | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let serial = 0
let deadline = 0
let remaining = 0
const listeners = new Set<() => void>()

export function showToast(text: string, action?: AppToast['action'], ms?: number): void {
  const total = ms ?? (action ? TOAST_ACTION_MS : TOAST_MS)
  current = { text, action, ms: total, id: ++serial }
  if (timer) clearTimeout(timer)
  remaining = total
  deadline = Date.now() + total
  timer = setTimeout(clearToast, total)
  listeners.forEach((l) => l())
}

export function clearToast(): void {
  current = null
  if (timer) clearTimeout(timer)
  timer = null
  listeners.forEach((l) => l())
}

/** Hold the clock while the pointer is over the message (the time bar pauses with it). */
export function pauseToast(): void {
  if (!current || !timer) return
  clearTimeout(timer)
  timer = null
  remaining = Math.max(0, deadline - Date.now())
}

export function resumeToast(): void {
  if (!current || timer) return
  deadline = Date.now() + remaining
  timer = setTimeout(clearToast, remaining)
}

/** The message now shown, if any (for code outside React). */
export function currentToast(): AppToast | null {
  return current
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
