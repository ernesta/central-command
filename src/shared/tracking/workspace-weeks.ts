import { addDays, dayNumber, daysBetween } from '../year'

/**
 * Workspaces whose "years" are contracts: each has its own first and last day (whole weeks) and is created by the
 * user, instead of following the app's 52-week year.
 */
export const CONTRACT_WORKSPACES: readonly string[] = ['work']

export function hasContracts(workspace: string): boolean {
  return CONTRACT_WORKSPACES.includes(workspace)
}

/** The longest contract, in weeks. */
export const MAX_CONTRACT_WEEKS = 156

/**
 * The number of weeks of a contract from its first to its last day, or a reason it is refused. A contract's weeks
 * begin on its own first day, whatever weekday that is (the current one runs Friday to Thursday, the previous one
 * Wednesday to Tuesday), so it ends on the day before a week would begin: whole weeks.
 */
export function contractWeeks(
  start: string,
  end: string
): { ok: true; weeks: number } | { ok: false; reason: 'bad-start' | 'bad-end' } {
  if (dayNumber(start) === null || dayNumber(end) === null)
    return { ok: false, reason: 'bad-start' }
  const days = daysBetween(start, end) + 1
  if (days < 7 || days % 7 !== 0 || days / 7 > MAX_CONTRACT_WEEKS)
    return { ok: false, reason: 'bad-end' }
  return { ok: true, weeks: days / 7 }
}

/** The first day a contract of `weeks` weeks starting on `start` leaves for the next. */
export function dayAfterContract(start: string, weeks: number): string {
  return addDays(start, weeks * 7)
}
