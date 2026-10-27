import { dailyAim } from '@shared/tracking/plan'
import { minutesByDate } from '@shared/tracking/totals'
import type { Moment, TimeOffType, TrackingYear } from '@shared/tracking/types'
import { addDays, daysBetween, weekdayOf, YEAR_WEEKS } from '@shared/year'
import { contractEnd } from '@shared/tracking/workspace-weeks'

export type HeatLevel = 0 | 1 | 2 | 3 | 4

export interface HeatDay {
  date: string
  minutes: number
  /** The day's aim; null on a weekend, a day off or any day that is not worked. */
  aim: number | null
  /** The kind of day off, if the day is one (a weekend date in the list does not count). */
  off: TimeOffType | null
  /** After today. */
  future: boolean
  /** 0 for no time, then 1 to 4 by the day's place among the worked days (`heatLevel`). */
  level: HeatLevel
}

/** Shades for a day with time: 1 (the lightest) to this, the busiest. 0 is no time. */
export const HEAT_LEVELS = 4

/**
 * How busy a day is, the same way in every workspace: where it stands among the days that have time, not against an aim or an
 * average, so a short day and a long one never look alike. Each day takes its place in the ranking of the worked days (days of
 * equal length share the middle of their place), cut into `HEAT_LEVELS` equal bands.
 */
export function heatLevel(minutes: number, worked: readonly number[]): HeatLevel {
  if (minutes <= 0) return 0
  if (worked.length === 0) return HEAT_LEVELS
  let below = 0
  let equal = 0
  for (const m of worked) {
    if (m < minutes) below++
    else if (m === minutes) equal++
  }
  const place = (below + equal / 2) / worked.length
  return (1 + Math.min(HEAT_LEVELS - 1, Math.floor(place * HEAT_LEVELS))) as HeatLevel
}

/**
 * Every day of the year, oldest first (364 of them, or a contract's, to its real last day), with its time, its aim and whether it
 * is a day off. Days after a contract's end in its last report week are not days: the grid leaves them empty.
 */
export function heatDays(year: TrackingYear, now: Moment): HeatDay[] {
  const minutes = minutesByDate(year, now)
  const off = new Map(year.timeOff.map((t) => [t.date, t.type]))
  const worked = [...minutes.values()].filter((m) => m > 0)
  return Array.from({ length: daysBetween(year.start, contractEnd(year)) + 1 }, (_, i) => {
    const date = addDays(year.start, i)
    const m = minutes.get(date) ?? 0
    const aim = dailyAim(year, date)
    return {
      date,
      minutes: m,
      aim,
      off: off.get(date) ?? null,
      future: date > now.date,
      level: heatLevel(m, worked)
    }
  })
}

/**
 * The days as a calendar grid whose weeks start on `firstDay` (1 Monday to 7 Sunday), whatever day the year starts on: empty
 * cells (null) fill the first week before the year's first day and the last week after its last, and the grid is a whole
 * number of weeks. Cell `i` is in column `floor(i / 7)` and row `i % 7`.
 */
export function heatGrid(
  year: TrackingYear,
  days: readonly HeatDay[],
  firstDay: number
): (HeatDay | null)[] {
  const lead = (weekdayOf(year.start) - firstDay + 7) % 7
  const grid: (HeatDay | null)[] = [...Array<null>(lead).fill(null), ...days]
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

/**
 * The weeks of the year to draw when only `capacity` fit across: as many as fit, ending with the week that holds `todayWeek`, so the
 * window slides with the date and shows as much of the past as there is room for. Early in the year, before there are that many
 * weeks behind today, it starts at the first week and runs on into the weeks to come to fill the width; it never runs past the
 * year's last week. A day outside the year counts as its first or last week.
 */
export function heatWindow(
  totalWeeks: number,
  todayWeek: number,
  capacity: number
): { first: number; count: number } {
  const count = Math.max(1, Math.min(Math.floor(capacity), totalWeeks))
  const today = Math.max(0, Math.min(todayWeek, totalWeeks - 1))
  return { first: Math.max(0, Math.min(today + 1 - count, totalWeeks - count)), count }
}

/**
 * The first column (week) each month starts in, for the labels above the grid: `[{ column: 0, month: 8 }, …]`. With `first` and
 * `count` only that window of weeks is labelled, and `column` counts from its first week (which is always labelled, even when its
 * month began before it). `lead` is the empty cells `heatGrid` puts before the year's first day.
 */
export function monthColumns(
  year: TrackingYear,
  first = 0,
  count = (year.weeks ?? YEAR_WEEKS) - first,
  lead = 0
): { column: number; month: number }[] {
  const out: { column: number; month: number }[] = []
  for (let column = 0; column < count; column++) {
    // A week belongs to the month its Thursday is in, so a label never sits on a week that is mostly the month before.
    const month = Number(addDays(year.start, (first + column) * 7 + 3 - lead).slice(5, 7)) - 1
    if (out.length === 0 || out[out.length - 1].month !== month) out.push({ column, month })
  }
  // A month that lasts under three columns before the next begins is left unlabelled, or its name would sit on the next one's.
  return out.filter((m, i) => i === out.length - 1 || out[i + 1].column - m.column >= 3)
}
