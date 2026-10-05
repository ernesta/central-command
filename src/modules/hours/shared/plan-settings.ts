import { parseHours } from '@shared/tracking/format'

/** Monday is 1, as in the plan's `workDays`. */
export const WEEKDAYS: readonly { day: number; label: string }[] = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 7, label: 'Sun' }
]

/** The days worked with one day switched on or off, in week order. Null when that would leave no day worked. */
export function toggleWorkDay(days: readonly number[], day: number): number[] | null {
  const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
  return next.length === 0 ? null : next.sort((a, b) => a - b)
}

/** The hours a week as minutes ("37:30" or "37.5"): more than none and no more than the week holds. Null otherwise. */
export function parseWeekHours(text: string): number | null {
  const minutes = parseHours(text)
  return minutes !== null && minutes > 0 && minutes <= 7 * 24 * 60 ? minutes : null
}

/** Days off a year: a whole number from 0 to 366. Null for anything else. */
export function parseAllowance(text: string): number | null {
  const t = text.trim()
  if (!/^\d{1,3}$/.test(t)) return null
  const days = Number(t)
  return days <= 366 ? days : null
}

/** The longest a client's name may be. */
export const MAX_CLIENT_LENGTH = 40

/** The client list with a name added: trimmed, not empty, not there already (ignoring case). Null when it cannot be added. */
export function addClient(clients: readonly string[], text: string): string[] | null {
  const name = text.trim().replace(/\s+/g, ' ')
  if (!name || name.length > MAX_CLIENT_LENGTH) return null
  if (clients.some((c) => c.toLowerCase() === name.toLowerCase())) return null
  return [...clients, name]
}

/** The client list without a name. Null when that would leave none (Work always has a client). */
export function removeClient(clients: readonly string[], name: string): string[] | null {
  const next = clients.filter((c) => c !== name)
  return next.length === 0 || next.length === clients.length ? null : next
}
