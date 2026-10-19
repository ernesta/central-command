/**
 * Dates and day names written the way the Mac's region writes them (the default locale), from a plain
 * `YYYY-MM-DD` date with no time zone involved.
 */

/** A date such as "2026-09-24" as text, in the given parts ("Sep 24, 2026" or "24 Sept 2026"). Anything else is returned as it is. */
export function localeDate(date: string, options: Intl.DateTimeFormatOptions): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return date
  const at = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return at.toLocaleDateString(undefined, { ...options, timeZone: 'UTC' })
}

/** A month's name, 1 to 12 ("Jan", "January"). */
export function monthName(month: number, style: 'short' | 'long' = 'short'): string {
  return new Date(Date.UTC(2024, month - 1, 1)).toLocaleDateString(undefined, {
    month: style,
    timeZone: 'UTC'
  })
}

/** A weekday's name, 1 (Monday) to 7 (Sunday) ("Mon", "M", "Monday"). */
export function weekdayName(weekday: number, style: 'narrow' | 'short' | 'long' = 'short'): string {
  // 1 January 2024 was a Monday.
  return new Date(Date.UTC(2024, 0, weekday)).toLocaleDateString(undefined, {
    weekday: style,
    timeZone: 'UTC'
  })
}

/** The weekday a calendar's weeks start on in the Mac's region, 1 (Monday) to 7 (Sunday); Monday when the region does not say. */
export function firstWeekday(): number {
  const locale = new Intl.Locale(
    new Intl.DateTimeFormat().resolvedOptions().locale
  ) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number }
    weekInfo?: { firstDay: number }
  }
  return locale.getWeekInfo?.().firstDay ?? locale.weekInfo?.firstDay ?? 1
}
