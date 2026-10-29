import { useSyncExternalStore } from 'react'
import { todayIso } from '@shared/time'

/**
 * Today's calendar date (changes at midnight), shared by every component that asks: one check every 30 seconds and when
 * the window comes back into view, so a page left open overnight (or a Mac that slept) shows the new day.
 */
const listeners = new Set<() => void>()
let current = todayIso()
let timer: ReturnType<typeof setInterval> | null = null

function check(): void {
  const next = todayIso()
  if (next === current) return
  current = next
  for (const listener of listeners) listener()
}

export function subscribeToday(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) {
    current = todayIso()
    timer = setInterval(check, 30_000)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      if (timer) clearInterval(timer)
      timer = null
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }
}

/** Today's date as YYYY-MM-DD, kept current. */
export function useToday(): string {
  return useSyncExternalStore(subscribeToday, () => todayIso())
}
