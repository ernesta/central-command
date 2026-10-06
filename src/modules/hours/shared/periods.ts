import { weekPlan } from '@shared/tracking/plan'
import { minutesByClient, weeklyMinutes } from '@shared/tracking/totals'
import { invoiceOf, type Moment, type TrackingYear } from '@shared/tracking/types'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

export interface MonthWeek {
  number: number
  from: string
  to: string
  /** Minutes worked in the week. */
  minutes: number
  /** The week's whole plan, in minutes. */
  plan: number
}

/**
 * What a contract is invoiced by, one at a time: an invoice month (whole weeks; see `monthsOf`), or, invoiced weekly,
 * a single week. An invoice month: whole weeks. A week belongs to the calendar month its first day is in, so a month starts the day
 * after the previous one ended and ends on the last day of the week that holds the calendar month's last day or
 * ends after it (October with weeks starting Oct 2, 9, 16, 23 and 30 ends on Nov 5).
 */
export interface ContractPeriod {
  /** `2026-10`, the calendar month of its weeks' first days. */
  id: string
  name: string
  from: string
  to: string
  weeks: MonthWeek[]
  /** Minutes worked in the month. */
  minutes: number
  /** The month's whole plan: its weeks' plans, in minutes. */
  plan: number
  /** Minutes per client (Work), only those with time; none where the plan has no clients. */
  clients: { client: string | null; minutes: number }[]
}

/** The months of a contract with their weeks, hours and plan, oldest first. */
export function monthsOf(year: TrackingYear, now?: Moment): ContractPeriod[] {
  const months: ContractPeriod[] = []
  for (const w of weeklyMinutes(year, now)) {
    const id = w.from.slice(0, 7)
    const last = months[months.length - 1]
    // Weeks are numbered from 1 in every month.
    const number = last?.id === id ? last.weeks.length + 1 : 1
    const week: MonthWeek = { ...w, number, plan: weekPlan(year, w.from) }
    if (last?.id === id) {
      last.weeks.push(week)
      last.to = w.to
      last.minutes += week.minutes
      last.plan += week.plan
    } else {
      months.push({
        id,
        name: MONTH_NAMES[Number(id.slice(5, 7)) - 1],
        from: w.from,
        to: w.to,
        weeks: [week],
        minutes: week.minutes,
        plan: week.plan,
        clients: []
      })
    }
  }
  // Clients are counted over the month's own days, so they add up to the month's minutes.
  if ((year.plan.clients ?? []).length > 0)
    for (const m of months) m.clients = minutesByClient(year, m.from, m.to, now)
  return months
}

/** The weeks of a contract invoiced weekly: one period each, named "Week 3" by its number in the contract. */
export function weekPeriodsOf(year: TrackingYear, now?: Moment): ContractPeriod[] {
  const clients = (year.plan.clients ?? []).length > 0
  return weeklyMinutes(year, now).map((w) => ({
    id: w.from,
    name: `Week ${w.number}`,
    from: w.from,
    to: w.to,
    weeks: [{ ...w, plan: weekPlan(year, w.from) }],
    minutes: w.minutes,
    plan: weekPlan(year, w.from),
    clients: clients ? minutesByClient(year, w.from, w.to, now) : []
  }))
}

/** What the contract is invoiced in: its months, or its single weeks when it is invoiced weekly. Oldest first. */
export function periodsOf(year: TrackingYear, now?: Moment): ContractPeriod[] {
  return invoiceOf(year) === 'week' ? weekPeriodsOf(year, now) : monthsOf(year, now)
}

/** The period a week is in. */
export function periodOfWeek(
  periods: readonly ContractPeriod[],
  week: string
): ContractPeriod | null {
  return periods.find((m) => m.weeks.some((w) => w.from === week)) ?? null
}

/** A period's plan for the weeks that have begun by `today`: what should be done by now (a week counts whole from its first day). */
export function periodPlanSoFar(period: ContractPeriod, today: string): number {
  return period.weeks.filter((w) => w.from <= today).reduce((sum, w) => sum + w.plan, 0)
}
