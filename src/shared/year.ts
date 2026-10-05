/**
 * The app's one year: it starts on a Monday and lasts 52 weeks (364 days), and is named by its start year
 * (`2026–27`). The starts are a list stored in Settings, oldest first. Dates are `YYYY-MM-DD` strings and
 * no time zone is involved anywhere (all arithmetic is on UTC day numbers).
 *
 * A date before the first listed start, or after the last year's end, belongs to the year found by stepping
 * 52 weeks from the nearest listed start, so a year always exists. A date between two listed years (a next
 * start edited later than 52 weeks on) belongs to no year.
 */

export const YEAR_WEEKS = 52
export const YEAR_DAYS = YEAR_WEEKS * 7

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 86_400_000

/** A date as a number of days since 1970-01-01; null for anything that is not a real date. */
export function dayNumber(date: string): number | null {
  const m = DATE.exec(date)
  if (!m) return null
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(ms)
  const ok =
    d.getUTCFullYear() === Number(m[1]) &&
    d.getUTCMonth() === Number(m[2]) - 1 &&
    d.getUTCDate() === Number(m[3])
  return ok ? Math.round(ms / DAY_MS) : null
}

function fromDayNumber(n: number): string {
  const d = new Date(n * DAY_MS)
  const pad = (v: number): string => String(v).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** The date `days` after (or before, if negative) another. Throws on a bad date: callers validate first. */
export function addDays(date: string, days: number): string {
  const n = dayNumber(date)
  if (n === null) throw new Error(`Not a date: ${date}`)
  return fromDayNumber(n + days)
}

/** Whole days from `a` to `b` (negative when b is earlier). */
export function daysBetween(a: string, b: string): number {
  const x = dayNumber(a)
  const y = dayNumber(b)
  if (x === null || y === null) throw new Error(`Not a date: ${a} or ${b}`)
  return y - x
}

/** Monday is 1 and Sunday is 7. */
export function weekdayOf(date: string): number {
  const n = dayNumber(date)
  if (n === null) throw new Error(`Not a date: ${date}`)
  // 1970-01-01 was a Thursday (4).
  return ((((n + 3) % 7) + 7) % 7) + 1
}

export function isMonday(date: string): boolean {
  return dayNumber(date) !== null && weekdayOf(date) === 1
}

/** The Monday of the week a date is in. */
export function weekStartOf(date: string): string {
  return addDays(date, 1 - weekdayOf(date))
}

/** A year's last day: 52 weeks less a day after its start. */
export function yearEnd(start: string, weeks = YEAR_WEEKS): string {
  return addDays(start, weeks * 7 - 1)
}

/** 2026 as "2026–27" (an en dash): a year named by the calendar year it starts in. */
export function startYearLabel(startYear: number): string {
  return `${startYear}–${String((startYear + 1) % 100).padStart(2, '0')}`
}

/** 2026-09-21 as "2026–27" (an en dash). */
export function yearLabel(start: string): string {
  return startYearLabel(Number(start.slice(0, 4)))
}

/** The start of the year after the current one: the next listed start, else 52 weeks on. */
export function nextYearStart(today: string, starts: readonly string[]): string {
  const current = currentYear(today, starts)
  return starts.find((s) => s > current) ?? addDays(current, YEAR_DAYS)
}

/**
 * Keep only the starts that are real Mondays, oldest first, without repeats, and at least 52 weeks apart
 * (a start that would cut the year before it short is dropped).
 */
export function normaliseYearStarts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const valid = [
    ...new Set(raw.filter((s): s is string => typeof s === 'string' && isMonday(s)))
  ].sort()
  const kept: string[] = []
  for (const s of valid) {
    const last = kept[kept.length - 1]
    if (last === undefined || daysBetween(last, s) >= YEAR_DAYS) kept.push(s)
  }
  return kept
}

/**
 * The start of the year a date falls in, or null when it is in no year (not a date, or in a gap between two
 * listed years). With no starts at all there are no years either.
 */
export function yearStartOf(date: string, starts: readonly string[]): string | null {
  const n = dayNumber(date)
  if (n === null || starts.length === 0) return null
  const first = starts[0]
  if (date < first) {
    const steps = Math.ceil((dayNumber(first)! - n) / YEAR_DAYS)
    return addDays(first, -steps * YEAR_DAYS)
  }
  let owner = first
  for (const s of starts) if (s <= date) owner = s
  if (n - dayNumber(owner)! < YEAR_DAYS) return owner
  // Past the owner's 52 weeks: the next listed start comes first if there is one (a gap), else step on.
  if (owner !== starts[starts.length - 1]) return null
  const steps = Math.floor((n - dayNumber(owner)!) / YEAR_DAYS)
  return addDays(owner, steps * YEAR_DAYS)
}

/** Whether a date is inside the year that starts on `start`. */
export function inYear(date: string, start: string, weeks = YEAR_WEEKS): boolean {
  const n = dayNumber(date)
  const s = dayNumber(start)
  return n !== null && s !== null && n >= s && n - s < weeks * 7
}

/** The year containing `today`. Falls back to the newest listed start (or today's own week) so there is always one. */
export function currentYear(today: string, starts: readonly string[]): string {
  return yearStartOf(today, starts) ?? starts[starts.length - 1] ?? weekStartOf(today)
}

/** The start the year after the last listed one gets by default: 52 weeks on. */
export function defaultNextStart(starts: readonly string[], today: string): string {
  const last = starts[starts.length - 1]
  return last === undefined ? weekStartOf(today) : addDays(last, YEAR_DAYS)
}

/**
 * Add the starts of every year that has begun since the last listed one, 52 weeks apart. Idempotent. With no
 * starts it returns none: the first start is the user's to give.
 */
export function rolloverStarts(starts: readonly string[], today: string): string[] {
  const out = [...starts]
  if (out.length === 0) return out
  while (daysBetween(out[out.length - 1], today) >= YEAR_DAYS) {
    out.push(addDays(out[out.length - 1], YEAR_DAYS))
  }
  return out
}

/**
 * Set the start of the next year, the one after the last listed. It must be a Monday and no earlier than 52 weeks
 * after the last start (a year is never shortened), and the year must not have begun. Returns the new list, or
 * null when refused. A year that has not begun is replaced, so the next start can be edited again and again.
 */
export function withNextStart(
  starts: readonly string[],
  next: string,
  today: string
): string[] | null {
  if (!isMonday(next) || starts.length === 0) return null
  const last = starts[starts.length - 1]
  const begun = daysBetween(last, today) >= 0
  // The editable one is the last start while it is still in the future, else a new one after it.
  const base = begun ? [...starts] : starts.slice(0, -1)
  const before = base[base.length - 1]
  if (before === undefined) return null
  if (daysBetween(before, next) < YEAR_DAYS || daysBetween(next, today) >= 0) return null
  return [...base, next]
}

export interface YearWeek {
  /** 1 to 52. */
  number: number
  from: string
  to: string
}

/** The 52 weeks of the year starting on `start`, Monday to Sunday. */
export function weeksOf(start: string, weeks = YEAR_WEEKS): YearWeek[] {
  return Array.from({ length: weeks }, (_, i) => ({
    number: i + 1,
    from: addDays(start, i * 7),
    to: addDays(start, i * 7 + 6)
  }))
}

/** The week number (1 to 52) of a date within the year starting on `start`; null when outside it. */
export function weekNumberOf(date: string, start: string, weeks = YEAR_WEEKS): number | null {
  return inYear(date, start, weeks) ? Math.floor(daysBetween(start, date) / 7) + 1 : null
}

/**
 * The years to offer: every one that has a date, plus the current one, newest first. The current year is always
 * there so a new year can be started before anything is in it.
 */
export function yearsPresent(
  dates: readonly string[],
  today: string,
  starts: readonly string[]
): string[] {
  const years = new Set<string>([currentYear(today, starts)])
  for (const d of dates) {
    const y = yearStartOf(d, starts)
    if (y !== null) years.add(y)
  }
  return [...years].sort().reverse()
}
