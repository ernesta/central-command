import { ALL_CONTRACTS, isAllContracts, validScope, type ContractScope } from './tracking/scope'
import { currentYear, inYear, nextYearStart, yearStartOf } from './year'

/**
 * What Research's pages are filtered by: every academic year, or one year by its start date. One scope for the whole workspace
 * (`docs/RESEARCH_YEAR_FILTER_PLAN.md`), the same idea as Work's contract filter, so it is the same value (`all`, or a start) and
 * `validScope` serves both.
 */
export type YearScope = ContractScope

export const ALL_YEARS = ALL_CONTRACTS

export const isAllYears = (scope: YearScope): boolean => isAllContracts(scope)

/** A remembered or addressed scope that is still valid: `all`, or the start of a year on offer; else null. */
export const validYearScope = (raw: unknown, offered: readonly string[]): YearScope | null =>
  validScope(raw, offered)

/** The years a scope covers: every one on offer under All, or just the chosen one. */
export function scopeYearStarts(scope: YearScope, offered: readonly string[]): string[] {
  return isAllYears(scope) ? [...offered] : [scope]
}

/**
 * Whether a date falls in the scope. Under All every date does, an undated item too (a planned meeting); under one year the date
 * must be inside it, so an undated item is not (the caller decides where undated items belong).
 */
export function inScopeYear(scope: YearScope, date: string): boolean {
  return isAllYears(scope) || inYear(date, scope)
}

/**
 * The one year a page that can only mean one year uses (the Training plan, the Hours and Time off grids, the Meetings PDF): the
 * chosen year, or the current year under All.
 */
export function singleYear(scope: YearScope, today: string, yearStarts: readonly string[]): string {
  return isAllYears(scope) ? currentYear(today, yearStarts) : scope
}

/** The year a list's selector shows for a scope: the year itself, or null under All (the rules take null as every year). */
export const periodOf = (scope: YearScope): string | null => (isAllYears(scope) ? null : scope)

/**
 * The years the selector offers, newest first: every listed start, every year that has a file or other content (`extra`, only
 * real year starts), the current year, and the next one, so a plan can be written before its year begins.
 */
export function offeredYears(
  today: string,
  yearStarts: readonly string[],
  extra: readonly string[] = []
): string[] {
  const years = new Set<string>(yearStarts)
  years.add(currentYear(today, yearStarts))
  if (yearStarts.length > 0) years.add(nextYearStart(today, yearStarts))
  for (const y of extra) if (yearStartOf(y, yearStarts) === y) years.add(y)
  return [...years].sort().reverse()
}
