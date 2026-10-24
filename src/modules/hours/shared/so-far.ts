import { weekTotals } from '@shared/tracking/plan'
import { dayMinutes, weekMinutes } from '@shared/tracking/totals'
import { invoiceOf, type Moment, type TrackingYear } from '@shared/tracking/types'
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
  defaultWeek(data.start, now.date, data.weeks, data.end)

/** The invoice period (month, or week) of the week the Hours page opens on: the Invoice card's figures. Null outside the contract. */
export function thisPeriod(data: TrackingYear, now: Moment): ContractPeriod | null {
  return periodOfWeek(periodsOf(data, now), thisWeek(data, now))
}

/** The figures Home shows for a workspace, and the Home summary and the widget file carry: time so far in the period, against its aim. */
export interface PeriodFigures {
  label: 'This week' | 'This month'
  /** The period's minutes. */
  minutes: number
  /** The period's whole aim in minutes; 0 when there is none. */
  aim: number
  /** Today's minutes. */
  today: number
  /** Minutes per client in the period (Work, only those with time); none where the plan has no clients. */
  clients: { client: string | null; minutes: number }[]
}

/**
 * The one decision about "time so far": the same choice the Hours page makes (a plan with a whole-week aim is shown by invoice period,
 * the month or the week; any other by week). `data` is the shown year (the stored one plus the hours the notes derive), so Home,
 * the summary and the widget file give the numbers the Hours page gives.
 */
export function periodFigures(data: TrackingYear, now: Moment): PeriodFigures {
  const period = data.plan.weekAim ? thisPeriod(data, now) : null
  const week = weekFigures(data, thisWeek(data, now), now)
  return {
    label: period && invoiceOf(data) === 'month' ? 'This month' : 'This week',
    minutes: period ? period.minutes : week.minutes,
    aim: period ? period.plan : week.aim,
    today: dayMinutes(data, now.date, now),
    clients: period?.clients ?? []
  }
}
