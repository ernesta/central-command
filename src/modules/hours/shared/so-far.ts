import { weekTotals } from '@shared/tracking/plan'
import { weekMinutes } from '@shared/tracking/totals'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import { addDays } from '@shared/year'
import { periodOfWeek, periodsOf, type ContractPeriod } from './periods'
import { defaultWeek } from './week'

/** A week's hours against its whole aim: the figures of the Hours page's Week card. */
export function weekFigures(
  data: TrackingYear,
  week: string,
  now: Moment
): { minutes: number; aim: number } {
  return {
    minutes: weekMinutes(data, week, now),
    aim: weekTotals(data, addDays(week, 6), now).find((w) => w.from === week)?.plan ?? 0
  }
}

/** The week the Hours page opens on, which is the one Home sums up. */
export const thisWeek = (data: TrackingYear, now: Moment): string =>
  defaultWeek(data.start, now.date, data.weeks)

/** The invoice period (month, or week) of the week the Hours page opens on: the Invoice card's figures. Null outside the contract. */
export function thisPeriod(data: TrackingYear, now: Moment): ContractPeriod | null {
  return periodOfWeek(periodsOf(data, now), thisWeek(data, now))
}
