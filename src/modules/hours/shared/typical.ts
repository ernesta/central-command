import { minutesByDate } from '@shared/tracking/totals'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import { addDays, daysBetween, weekdayOf } from '@shared/year'

export interface TypicalDay {
  /** Monday is 1 and Sunday is 7. */
  weekday: number
  /** Minutes on an ordinary one of these days; 0 when there has not been one. */
  average: number
  /** The days it is the average of. */
  days: number
  /** Minutes aimed at on a work day; null on the other days and where the aim is the whole week's. */
  aim: number | null
}

/**
 * The year's typical week: for each weekday, the average time over its days so far. Today is left out (it is
 * not over) and so are days off, so a holiday does not drag its weekday down. Weekends are kept: a day that is
 * not worked still counts, at zero when nothing was tracked.
 */
export function typicalWeek(year: TrackingYear, now: Moment): TypicalDay[] {
  const minutes = minutesByDate(year, now)
  const off = new Set(year.timeOff.map((t) => t.date))
  const sums = Array.from({ length: 7 }, () => ({ total: 0, days: 0 }))
  const perDay =
    year.plan.workDays.length > 0 ? year.plan.hoursPerWeek / year.plan.workDays.length : 0
  const through = daysBetween(year.start, now.date) // days before today
  for (let i = 0; i < through && i < (year.weeks ?? 52) * 7; i++) {
    const date = addDays(year.start, i)
    if (off.has(date)) continue
    const s = sums[weekdayOf(date) - 1]
    s.total += minutes.get(date) ?? 0
    s.days++
  }
  // In the order of the year's own weeks: from the weekday it starts on.
  const first = weekdayOf(year.start) - 1
  return Array.from({ length: 7 }, (_, k) => {
    const i = (first + k) % 7
    const s = sums[i]
    return {
      weekday: i + 1,
      average: s.days === 0 ? 0 : s.total / s.days,
      days: s.days,
      aim: !year.plan.weekAim && year.plan.workDays.includes(i + 1) ? perDay : null
    }
  })
}
