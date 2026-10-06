import { dailyAim, hasAim } from '@shared/tracking/plan'
import { minutesByDate } from '@shared/tracking/totals'
import type { Moment, TimeOffType, TrackingYear } from '@shared/tracking/types'
import { addDays, YEAR_WEEKS } from '@shared/year'

export interface HeatDay {
  date: string
  minutes: number
  /** The day's aim; null on a weekend, a day off or any day that is not worked. */
  aim: number | null
  /** The kind of day off, if the day is one (a weekend date in the list does not count). */
  off: TimeOffType | null
  /** After today. */
  future: boolean
  /** 0 for no time, then 1 to 3 for under half, under all, and all of the day's aim or more. */
  level: 0 | 1 | 2 | 3
}

/**
 * How full a day is: against its aim, or, on a day with none, against an average work day. With no aim at all (a contract
 * with no fixed hours) a day is shaded against the year's busiest day.
 */
export function heatLevel(minutes: number, reference: number): 0 | 1 | 2 | 3 {
  if (minutes <= 0) return 0
  if (reference <= 0) return 3
  const share = minutes / reference
  return share < 0.5 ? 1 : share < 1 ? 2 : 3
}

/** Every day of the year, oldest first (364 of them, or a contract's), with its time, its aim and whether it is a day off. */
export function heatDays(year: TrackingYear, now: Moment): HeatDay[] {
  const minutes = minutesByDate(year, now)
  const off = new Map(year.timeOff.map((t) => [t.date, t.type]))
  const average =
    year.plan.workDays.length > 0 ? year.plan.hoursPerWeek / year.plan.workDays.length : 0
  const reference = hasAim(year) ? null : Math.max(0, ...minutes.values())
  return Array.from({ length: (year.weeks ?? YEAR_WEEKS) * 7 }, (_, i) => {
    const date = addDays(year.start, i)
    const m = minutes.get(date) ?? 0
    const aim = dailyAim(year, date)
    return {
      date,
      minutes: m,
      aim,
      off: off.get(date) ?? null,
      future: date > now.date,
      level: heatLevel(m, reference ?? aim ?? average)
    }
  })
}

/** The first column (week) each month starts in, for the labels above the grid: `[{ column: 0, month: 8 }, …]`. */
export function monthColumns(year: TrackingYear): { column: number; month: number }[] {
  const out: { column: number; month: number }[] = []
  for (let week = 0; week < (year.weeks ?? YEAR_WEEKS); week++) {
    // A week belongs to the month its Thursday is in, so a label never sits on a week that is mostly the month before.
    const month = Number(addDays(year.start, week * 7 + 3).slice(5, 7)) - 1
    if (out.length === 0 || out[out.length - 1].month !== month) out.push({ column: week, month })
  }
  // A month that lasts under three columns before the next begins is left unlabelled, or its name would sit on the next one's.
  return out.filter((m, i) => i === out.length - 1 || out[i + 1].column - m.column >= 3)
}
