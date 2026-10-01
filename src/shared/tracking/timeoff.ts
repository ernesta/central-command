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

/**
 * Add days off from `from` to `to` inclusive. Weekends are skipped; a date outside the year refuses the whole
 * request; a date already listed takes the new type.
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
  const dates = new Set(added.map((e) => e.date))
  const timeOff = [...year.timeOff.filter((e) => !dates.has(e.date)), ...added].sort((a, b) =>
    a.date.localeCompare(b.date)
  )
  return { ok: true, year: { ...year, timeOff } }
}

export function removeTimeOff(year: TrackingYear, date: string): TrackingYear {
  return { ...year, timeOff: year.timeOff.filter((e) => e.date !== date) }
}
