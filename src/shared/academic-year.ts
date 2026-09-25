/**
 * The academic year runs from 1 September to 31 August and is shown as `2025–26`. Years are
 * identified by the calendar year they start in (2025 for 2025–26). Dates are `YYYY-MM-DD` strings
 * and no time zone is involved anywhere.
 */

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** The start year of the academic year a date falls in; null for anything that is not a date. */
export function academicYearOf(date: string): number | null {
  const m = DATE.exec(date)
  if (!m) return null
  return Number(m[2]) >= 9 ? Number(m[1]) : Number(m[1]) - 1
}

/** 2025 as "2025–26" (an en dash). */
export function academicYearLabel(startYear: number): string {
  return `${startYear}–${String((startYear + 1) % 100).padStart(2, '0')}`
}

/** The first and last day of an academic year. */
export function academicYearRange(startYear: number): { from: string; to: string } {
  return { from: `${startYear}-09-01`, to: `${startYear + 1}-08-31` }
}

/** The academic year containing `today`. */
export function currentAcademicYear(today: string): number {
  return academicYearOf(today) ?? new Date().getFullYear()
}

/** Whether a date belongs to the given academic year. */
export function inAcademicYear(date: string, startYear: number): boolean {
  return academicYearOf(date) === startYear
}

/**
 * The academic years to offer: every one that has a date, plus the current one, newest first. The
 * current year is always there so a new year can be started before anything is in it.
 */
export function academicYearsPresent(dates: readonly string[], today: string): number[] {
  const years = new Set<number>([currentAcademicYear(today)])
  for (const d of dates) {
    const y = academicYearOf(d)
    if (y !== null) years.add(y)
  }
  return [...years].sort((a, b) => b - a)
}
