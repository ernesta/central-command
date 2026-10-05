import { yearTotals } from '@shared/tracking/plan'
import { timeOffCounts } from '@shared/tracking/timeoff'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import { yearEnd } from '@shared/year'

export interface YearRow {
  start: string
  end: string
  /** Minutes worked so far (the whole year once it is over). */
  minutes: number
  /** The plan so far, in minutes. */
  plan: number
  balance: number
  /** Null before any day of the year has been planned. */
  averageWeek: number | null
  /** Days off before today. */
  daysOff: number
}

/** One row per year, newest first, for the Years table. */
export function yearRows(years: readonly TrackingYear[], now: Moment): YearRow[] {
  return years
    .map((data) => {
      const totals = yearTotals(data, now.date, now)
      return {
        start: data.start,
        end: yearEnd(data.start, data.weeks),
        minutes: totals.minutes,
        plan: totals.plan,
        balance: totals.balance,
        averageWeek: totals.averageWeek,
        daysOff: timeOffCounts(data, now.date).taken
      }
    })
    .sort((a, b) => b.start.localeCompare(a.start))
}
