import { normaliseTime } from './front-matter'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function minutes(time: string | null): number | null {
  const t = time ? normaliseTime(time) : null
  return t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null
}

/** End minus start in minutes; null when either is missing or the end is not after the start. */
export function durationMinutes(start: string | null, end: string | null): number | null {
  const a = minutes(start)
  const b = minutes(end)
  return a === null || b === null || b <= a ? null : b - a
}

export function formatDuration(totalMinutes: number): string {
  return `${totalMinutes} min`
}

/** "2026-09-24" as "Sep 24, 2026", with no time zone involved. Anything else is returned as it is. */
export function formatDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return date
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}, ${m[1]}`
}

/** The page heading: "Series · Sep 24, 2026". */
export function meetingHeading(series: string, date: string): string {
  return [series || 'Meeting', date ? formatDate(date) : ''].filter(Boolean).join(' · ')
}
