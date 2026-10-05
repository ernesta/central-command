import { addDays, daysBetween, inYear, yearEnd } from '@shared/year'

/** The week a year's page opens on: this week, or the nearest one when today is outside the year (its first or last). */
export function defaultWeek(yearStart: string, today: string, weeks?: number): string {
  if (today < yearStart) return yearStart
  const last = yearEnd(yearStart, weeks)
  const day = today > last ? last : today
  return addDays(yearStart, Math.floor(daysBetween(yearStart, day) / 7) * 7)
}

/** The week asked for (the first day of one of the year's weeks), else the default one. */
export function resolveWeek(
  asked: string | null,
  yearStart: string,
  today: string,
  weeks?: number
): string {
  // No year yet (a workspace with contracts before the first is made): no week either.
  if (yearStart === '') return ''
  return asked !== null &&
    inYear(asked, yearStart, weeks) &&
    daysBetween(yearStart, asked) % 7 === 0
    ? asked
    : defaultWeek(yearStart, today, weeks)
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
