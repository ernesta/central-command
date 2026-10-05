import { addDays, daysBetween, weekdayOf } from '../year'

/** The weekday a workspace's weeks begin on, Monday = 1. Work's contract runs Friday to Thursday. */
const WEEK_START_DAY: Record<string, number> = { work: 5 }

export function weekStartDay(workspace: string): number {
  return WEEK_START_DAY[workspace] ?? 1
}

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
 * The number of weeks of a contract from its first to its last day, or a reason it is refused: it starts on the day
 * the workspace's weeks begin and ends on the day before the next would, so it is whole weeks.
 */
export function contractWeeks(
  workspace: string,
  start: string,
  end: string
): { ok: true; weeks: number } | { ok: false; reason: 'bad-start' | 'bad-end' } {
  if (weekdayOf(start) !== weekStartDay(workspace)) return { ok: false, reason: 'bad-start' }
  const days = daysBetween(start, end) + 1
  if (days < 7 || days % 7 !== 0 || days / 7 > MAX_CONTRACT_WEEKS)
    return { ok: false, reason: 'bad-end' }
  return { ok: true, weeks: days / 7 }
}

/** The first day a contract of `weeks` weeks starting on `start` leaves for the next. */
export function dayAfterContract(start: string, weeks: number): string {
  return addDays(start, weeks * 7)
}
