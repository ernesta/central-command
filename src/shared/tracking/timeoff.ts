import { addDays, daysBetween, inYear, weekdayOf } from '../year'
import type { Change, TimeOffEntry, TimeOffType, TrackingYear } from './types'

export interface TimeOffCounts {
  allowance: number
  /** Days before today. */
  taken: number
  /** Today or later, not yet taken. */
  booked: number
  /** allowance − taken − booked. */
  left: number
  byType: Record<TimeOffType, number>
}

/** A weekend date is never a day off that counts. */
function counts(entry: TimeOffEntry, year: TrackingYear): boolean {
  return inYear(entry.date, year.start) && weekdayOf(entry.date) <= 5
}

/** Counted from the rows inside the year, never typed in. */
export function timeOffCounts(year: TrackingYear, today: string): TimeOffCounts {
  const byType: Record<TimeOffType, number> = { public: 0, university: 0, leave: 0 }
  let taken = 0
  let booked = 0
  const seen = new Set<string>()
  for (const e of year.timeOff) {
    if (!counts(e, year) || seen.has(e.date)) continue
    seen.add(e.date)
    byType[e.type]++
    if (e.date < today) taken++
    else booked++
  }
  const allowance = year.plan.allowanceDays
  return { allowance, taken, booked, left: allowance - taken - booked, byType }
}

export interface TimeOffRow extends TimeOffEntry {
  /** Before today. A day off today or later is still booked. */
  taken: boolean
}

/** The days off the counts include (inside the year, a weekday, each date once), oldest first. */
export function timeOffRows(year: TrackingYear, today: string): TimeOffRow[] {
  const seen = new Set<string>()
  return year.timeOff
    .filter((e) => counts(e, year) && !seen.has(e.date) && seen.add(e.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ ...e, taken: e.date < today }))
}

/** The first day off today or later, or null. */
export function nextDayOff(year: TrackingYear, today: string): string | null {
  return timeOffRows(year, today).find((r) => !r.taken)?.date ?? null
}

/** Which type wins when a date is listed twice: lower is stronger. */
const RANK: Record<TimeOffType, number> = { public: 0, university: 1, leave: 2 }

/**
 * Add days off from `from` to `to` inclusive. Weekends are skipped; a date outside the year refuses the whole
 * request; a date already listed keeps whichever type ranks higher (public holiday, then university holiday, then
 * leave), whatever order they were added in.
 */
export function addTimeOff(
  year: TrackingYear,
  from: string,
  to: string,
  type: TimeOffType
): Change {
  if (!inYear(from, year.start) || !inYear(to, year.start))
    return { ok: false, reason: 'outside-year' }
  if (daysBetween(from, to) < 0) return { ok: false, reason: 'backwards' }
  const added: TimeOffEntry[] = []
  for (let d = from; d <= to; d = addDays(d, 1))
    if (weekdayOf(d) <= 5) added.push({ date: d, type })
  if (added.length === 0) return { ok: false, reason: 'weekend' }
  const byDate = new Map(year.timeOff.map((e) => [e.date, e]))
  for (const e of added) {
    const listed = byDate.get(e.date)
    if (!listed || RANK[e.type] < RANK[listed.type]) byDate.set(e.date, e)
  }
  const timeOff = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  return { ok: true, year: { ...year, timeOff } }
}

/** Change the type of a day already listed (the one way to turn a holiday into leave); an unlisted date is left alone. */
export function setTimeOffType(year: TrackingYear, date: string, type: TimeOffType): TrackingYear {
  return { ...year, timeOff: year.timeOff.map((e) => (e.date === date ? { ...e, type } : e)) }
}

export function removeTimeOff(year: TrackingYear, date: string): TrackingYear {
  return { ...year, timeOff: year.timeOff.filter((e) => e.date !== date) }
}
