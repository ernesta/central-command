import { normaliseTime } from './front-matter'
import { localeDate } from './locale-names'
import { QUARTER } from './tracking/rounding'

function minutes(time: string | null): number | null {
  const t = time ? normaliseTime(time) : null
  return t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null
}

/** End minus start in minutes, to the nearest quarter hour (as every report of time is); null when either is missing or the end is not after the start. */
export function durationMinutes(start: string | null, end: string | null): number | null {
  const a = minutes(start)
  const b = minutes(end)
  return a === null || b === null || b <= a
    ? null
    : Math.floor((b - a + QUARTER / 2) / QUARTER) * QUARTER
}

/** Both times are set and the end is earlier than the start. */
export function endBeforeStart(start: string | null, end: string | null): boolean {
  const a = minutes(start)
  const b = minutes(end)
  return a !== null && b !== null && b < a
}

/** A length of time in hours and minutes: "45 min", "3 h", "1 h 30 min". */
export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`
}

/** "2026-09-24" as "Sep 24, 2026" (or "24 Sept 2026"), in the Mac's region, with no time zone involved. Anything else is returned as it is. */
export function formatDate(date: string): string {
  return localeDate(date, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** The page heading: "Series · Sep 24, 2026". */
export function meetingHeading(series: string, date: string): string {
  return [series || 'Meeting', date ? formatDate(date) : 'No date'].join(' · ')
}

/** "2026-09-24" as "Sep 24" (no year), for compact labels. Anything else is returned as it is. */
export function formatShortDate(date: string): string {
  return localeDate(date, { month: 'short', day: 'numeric' })
}

/** Today's date in local time as YYYY-MM-DD. */
export function todayIso(now = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** The time of day in local time as HH:MM. */
export function clockNow(now = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`
}

/**
 * A meeting or training that has not finished yet: planned with no date, dated after `today`, or dated today and
 * not over: before its end, or, with a start only, before its start. With no times it is a day-level fact (today's
 * is done), and so is every session when `now` (HH:MM) is not given.
 */
export function isUpcomingSession(
  row: { date: string; start?: string | null; end?: string | null },
  today: string,
  now?: string
): boolean {
  if (row.date === '') return true
  if (row.date !== today) return row.date > today
  const at = minutes(now ?? null)
  const over = minutes(row.end ?? null) ?? minutes(row.start ?? null)
  return at !== null && over !== null && at < over
}

/** When a tracking day ends and the next begins, as an hour of the morning. A setting later; fixed at 4 for now. */
export const DAY_END_HOUR = 4

/**
 * Now as the Hours timer sees it: the day runs from `DAY_END_HOUR` to the same hour the next morning, so at 01:30 it
 * is still the day before, and the time reads 25:30:00 (hours past 24 belong to the late part of that day).
 */
export function trackingMoment(now = new Date()): { date: string; time: string } {
  const { date, time } = nowMoment(now)
  const hour = Number(time.slice(0, 2))
  if (hour >= DAY_END_HOUR) return { date, time }
  const previous = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  return { date: todayIso(previous), time: `${hour + 24}${time.slice(2)}` }
}

/** Now in local time, as the date and the time to the second the timer works with. */
export function nowMoment(now = new Date()): { date: string; time: string } {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return {
    date: todayIso(now),
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  }
}
