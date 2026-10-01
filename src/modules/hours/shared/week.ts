import { addDays, inYear, isMonday, weekStartOf, yearEnd } from '@shared/year'

/** The week a year's page opens on: this week, or the nearest one when today is outside the year (its first or last). */
export function defaultWeek(yearStart: string, today: string): string {
  if (today < yearStart) return yearStart
  const last = yearEnd(yearStart)
  return weekStartOf(today > last ? last : today)
}

/** The week asked for (a Monday inside the year), else the default one. */
export function resolveWeek(asked: string | null, yearStart: string, today: string): string {
  return asked !== null && isMonday(asked) && inYear(asked, yearStart)
    ? asked
    : defaultWeek(yearStart, today)
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
