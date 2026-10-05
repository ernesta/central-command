import { weekPlan } from '@shared/tracking/plan'
import { minutesByClient, weeklyMinutes } from '@shared/tracking/totals'
import type { Moment, TrackingYear } from '@shared/tracking/types'

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
 * An invoice month: whole weeks. A week belongs to the calendar month its first day is in, so a month starts the day
 * after the previous one ended and ends on the last day of the week that holds the calendar month's last day or
 * ends after it (October with weeks starting Oct 2, 9, 16, 23 and 30 ends on Nov 5).
 */
export interface ContractMonth {
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
export function monthsOf(year: TrackingYear, now?: Moment): ContractMonth[] {
  const months: ContractMonth[] = []
  for (const w of weeklyMinutes(year, now)) {
    const id = w.from.slice(0, 7)
    const week: MonthWeek = { ...w, plan: weekPlan(year, w.from) }
    const last = months[months.length - 1]
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

/** The month a week is in. */
export function monthOfWeek(months: readonly ContractMonth[], week: string): ContractMonth | null {
  return months.find((m) => m.weeks.some((w) => w.from === week)) ?? null
}
