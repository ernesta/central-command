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

/** The longest a contract's name may be. */
export const MAX_CONTRACT_NAME_LENGTH = 40

/** The most clients one contract may list. */
export const MAX_CLIENTS = 20

/** Clients typed as one line, comma separated: each trimmed, none empty, none twice (ignoring case). Null when there is none or one is too long. */
export function parseClientList(text: string): string[] | null {
  let clients: string[] = []
  for (const part of text.split(',')) {
    if (part.trim() === '') continue
    const next = addClient(clients, part)
    if (!next) return null
    clients = next
  }
  return clients.length > 0 && clients.length <= MAX_CLIENTS ? clients : null
}

/** A new contract's weekly hours as typed: blank is no fixed hours (0), else a time as for the plan. Null when it cannot be read. */
export function parseContractHours(text: string): number | null {
  return text.trim() === '' ? 0 : parseWeekHours(text)
}

/** Why the store refuses a new contract, in a few words. */
export function contractRefusal(reason: string): string {
  switch (reason) {
    case 'same-start':
      return 'Another contract starts that day.'
    case 'client-overlap':
      return 'A client is in another contract on those days.'
    case 'bad-name':
      return 'Give the contract a name.'
    case 'bad-plan':
      return 'Check the clients and weekly hours.'
    case 'bad-start':
    case 'bad-end':
      return 'Check the dates.'
    default:
      return 'Could not add it. Try again.'
  }
}
