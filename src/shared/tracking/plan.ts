import { addDays, daysBetween, inYear, weekdayOf, weeksOf, yearEnd } from '../year'
import { minutesByDate, weeklyMinutes } from './totals'
import { unlistedAllowance } from './timeoff'
import type { Moment, TrackingYear } from './types'

function offDates(year: TrackingYear): Set<string> {
  return new Set(year.timeOff.map((t) => t.date))
}

function isPlannedDay(year: TrackingYear, off: Set<string>, date: string): boolean {
  return year.plan.workDays.includes(weekdayOf(date)) && !off.has(date)
}

/**
 * The week's planned working days: the work days not in the time-off list (a weekend date in the list changes
 * nothing), or the number typed in the old sheet for that week when there is one.
 */
export function plannedDays(year: TrackingYear, weekStart: string): number {
  const typed = year.weekDays[weekStart]
  if (typed !== undefined) return typed
  return plannedDaysComputed(year, weekStart)
}

function plannedDaysComputed(year: TrackingYear, weekStart: string): number {
  const off = offDates(year)
  let n = 0
  for (let i = 0; i < 7; i++) if (isPlannedDay(year, off, addDays(weekStart, i))) n++
  return n
}

/** Minutes aimed at on a planned day: the week's hours over the days worked. Null on any other day. */
export function dailyAim(year: TrackingYear, date: string): number | null {
  const days = year.plan.workDays.length
  if (year.plan.weekAim || days === 0 || !inYear(date, year.start, year.weeks)) return null
  return isPlannedDay(year, offDates(year), date) ? year.plan.hoursPerWeek / days : null
}

/** The week's plan in minutes: the weekly hours less a share for each work day that is not planned. */
export function weekPlan(year: TrackingYear, weekStart: string): number {
  const days = year.plan.workDays.length
  return days === 0 ? 0 : (year.plan.hoursPerWeek * plannedDays(year, weekStart)) / days
}

/** The planned days and plan for the part of a week up to `through` (today). A week not over ignores typed days. */
function weekThrough(
  year: TrackingYear,
  weekStart: string,
  through: string
): { days: number; plan: number } {
  const weekEnd = addDays(weekStart, 6)
  if (weekStart > through) return { days: 0, plan: 0 }
  if (weekEnd <= through || year.plan.weekAim)
    return { days: plannedDays(year, weekStart), plan: weekPlan(year, weekStart) }
  const off = offDates(year)
  let days = 0
  for (let i = 0; addDays(weekStart, i) <= through; i++)
    if (isPlannedDay(year, off, addDays(weekStart, i))) days++
  const workDays = year.plan.workDays.length
  return { days, plan: workDays === 0 ? 0 : (year.plan.hoursPerWeek * days) / workDays }
}

/**
 * The plan's share for allowance days not listed as days off, in minutes. It comes off the plan on the year's last day
 * (so the running balance is not ahead all year), and a day never taken is then credited on top of the hours worked.
 */
export function unlistedCredit(year: TrackingYear): number {
  const days = year.plan.workDays.length
  return days === 0 ? 0 : (unlistedAllowance(year) * year.plan.hoursPerWeek) / days
}

/** The year's last day: the last day of its last week. */
function lastDay(year: TrackingYear): string {
  return yearEnd(year.start, year.weeks)
}

export interface YearTotals {
  /** Minutes worked up to and including today. */
  minutes: number
  /** Planned working days up to and including today. */
  plannedDays: number
  /** The plan up to and including today, in minutes. */
  plan: number
  /** minutes − plan: plus is ahead, minus is behind. */
  balance: number
  /** minutes ÷ plannedDays × work days a week; null before any day is planned. */
  averageWeek: number | null
  /** The whole year's plan (52 weeks), in minutes. */
  wholePlan: number
}

/** The year so far: today counts in full, future days and weeks are not in the plan. */
export function yearTotals(year: TrackingYear, today: string, now?: Moment): YearTotals {
  let days = 0
  const credit = unlistedCredit(year)
  let plan = today >= lastDay(year) ? -credit : 0
  let wholePlan = -credit
  for (const w of weeksOf(year.start, year.weeks)) {
    const t = weekThrough(year, w.from, today)
    days += t.days
    plan += t.plan
    wholePlan += weekPlan(year, w.from)
  }
  let minutes = 0
  for (const [date, m] of minutesByDate(year, now)) if (date <= today) minutes += m
  return {
    minutes,
    plannedDays: days,
    plan,
    balance: minutes - plan,
    averageWeek: days === 0 ? null : (minutes / days) * year.plan.workDays.length,
    wholePlan
  }
}

export interface WeekTotals {
  number: number
  from: string
  to: string
  minutes: number
  plan: number
  plannedDays: number
  /** minutes − plan counted up to today. */
  balance: number
  /** The running balance at the end of this week (up to today). */
  yearBalance: number
  /** Whether any of the week is still to come. */
  inProgress: boolean
}

/** Every week with its hours, plan so far and running balance, for the weeks table and the balance chart. */
export function weekTotals(year: TrackingYear, today: string, now?: Moment): WeekTotals[] {
  const credit = unlistedCredit(year)
  const last = lastDay(year)
  let running = 0
  const days = minutesByDate(year, now)
  return weeklyMinutes(year, now).map((w) => {
    const t = weekThrough(year, w.from, today)
    let minutes = 0
    for (let i = 0; i < 7; i++) {
      const d = addDays(w.from, i)
      if (d <= today) minutes += days.get(d) ?? 0
    }
    running += minutes - t.plan
    if (today >= last && w.to === last) running += credit
    return {
      number: w.number,
      from: w.from,
      to: w.to,
      minutes: w.minutes,
      plan: t.plan,
      plannedDays: t.days,
      balance: minutes - t.plan,
      yearBalance: running,
      inProgress: daysBetween(w.to, today) < 0
    }
  })
}
