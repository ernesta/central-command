import { formatDate } from '../time'
import { addDays, dayNumber, daysBetween, inYear, yearEnd } from '../year'
import type { TrackingYear } from './types'

/**
 * Workspaces whose "years" are contracts: each has its own first and last day and is created by the
 * user, instead of following the app's 52-week year.
 */
export const CONTRACT_WORKSPACES: readonly string[] = ['work']

export function hasContracts(workspace: string): boolean {
  return CONTRACT_WORKSPACES.includes(workspace)
}

/** The longest contract, in weeks. */
export const MAX_CONTRACT_WEEKS = 156

/**
 * The report weeks of a contract from its first to its last day, or a reason it is refused. A contract may be any
 * length (one day included): the weeks are only the reporting grid, counted from its own first day and rounded up, so
 * the last may be partial. Only an end before the start, or past the longest contract, is refused.
 */
export function contractWeeks(
  start: string,
  end: string
): { ok: true; weeks: number } | { ok: false; reason: 'bad-start' | 'bad-end' } {
  if (dayNumber(start) === null || dayNumber(end) === null)
    return { ok: false, reason: 'bad-start' }
  const days = daysBetween(start, end) + 1
  const weeks = Math.ceil(days / 7)
  if (days < 1 || weeks > MAX_CONTRACT_WEEKS) return { ok: false, reason: 'bad-end' }
  return { ok: true, weeks }
}

/**
 * A contract's real last day: its `end`, else (an older file) the last day of its last report week. A date is in the
 * contract when it is from the first day to this one; days after it in the last report week belong to no contract.
 */
export function contractEnd(year: Pick<TrackingYear, 'start' | 'weeks' | 'end'>): string {
  return year.end ?? yearEnd(year.start, year.weeks)
}

/** Whether a date is a day of the contract (or of the shared year): inside its report weeks and not after its real end. */
export function inContract(
  date: string,
  year: Pick<TrackingYear, 'start' | 'weeks' | 'end'>
): boolean {
  return inYear(date, year.start, year.weeks) && date <= contractEnd(year)
}

/** The first day a contract leaves for the next: the day after its real last day. */
export function dayAfterContract(year: Pick<TrackingYear, 'start' | 'weeks' | 'end'>): string {
  return addDays(contractEnd(year), 1)
}

/**
 * A contract by its name and its first and last day: "Luminos · 1 May 2026 – 29 Oct 2026" (the dates alone when it has
 * no name). Without its length, by its first day.
 */
export function contractLabel(
  start: string,
  weeks: number | undefined,
  name?: string,
  end?: string
): string {
  const dates =
    weeks === undefined
      ? formatDate(start)
      : `${formatDate(start)} – ${formatDate(end ?? addDays(start, weeks * 7 - 1))}`
  return name ? `${name} · ${dates}` : dates
}
