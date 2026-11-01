import { addDays, daysBetween, inYear, yearEnd } from '@shared/year'

/** The week a year's page opens on: this week, or the first one when today is outside the year (a finished year reads from its start). */
export function defaultWeek(
  yearStart: string,
  today: string,
  weeks?: number,
  end?: string
): string {
  // The real last day (a contract's `end`), not the end of its last report week: a day after it is outside the contract.
  if (today < yearStart || today > (end ?? yearEnd(yearStart, weeks))) return yearStart
  return addDays(yearStart, Math.floor(daysBetween(yearStart, today) / 7) * 7)
}

/** The week asked for (the first day of one of the year's weeks), else the default one. */
export function resolveWeek(
  asked: string | null,
  yearStart: string,
  today: string,
  weeks?: number,
  end?: string
): string {
  // No year yet (a workspace with contracts before the first is made): no week either.
  if (yearStart === '') return ''
  return asked !== null &&
    inYear(asked, yearStart, weeks) &&
    daysBetween(yearStart, asked) % 7 === 0
    ? asked
    : openingWeek(yearStart, today, weeks, end)
}

/** The week the page opens on: today's, or the last one once the contract is over (its latest month, not its first). */
function openingWeek(yearStart: string, today: string, weeks?: number, end?: string): string {
  const last = end ?? yearEnd(yearStart, weeks)
  return today > last
    ? addDays(yearStart, Math.floor(daysBetween(yearStart, last) / 7) * 7)
    : defaultWeek(yearStart, today, weeks, end)
}

/** A day's bar is drawn up to this many times the aim; the aim's tick sits at 1 ÷ this. */
export const BAR_SCALE = 1.4

/** How full a day's bar is, 0 to 1 of the track: the day's time against the aim, capped at `BAR_SCALE` times it. */
export function barFill(minutes: number, aim: number | null, perDay: number): number {
  const base = aim ?? perDay
  return base <= 0 ? 0 : Math.min(minutes / base, BAR_SCALE) / BAR_SCALE
}

/** The seven days of a week. */
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}
