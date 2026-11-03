import { holding } from '@shared/tracking/contracts'
import {
  allDay,
  allMinutes,
  allWeek,
  workWeekStart,
  type ContractShare
} from '@shared/tracking/scope'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import { periodFigures, type PeriodFigures } from './so-far'

/** Minutes per client, the same client's time from different shares added up, clients with time only. */
export function mergeClients(
  shares: readonly Pick<ContractShare, 'clients'>[]
): { client: string | null; minutes: number }[] {
  const sums = new Map<string | null, number>()
  for (const share of shares)
    for (const c of share.clients) sums.set(c.client, (sums.get(c.client) ?? 0) + c.minutes)
  return [...sums]
    .filter(([, minutes]) => minutes !== 0)
    .map(([client, minutes]) => ({ client, minutes }))
}

/** One contract's time so far in its own invoice period, hours only (no aim): a row of Home under All. */
export interface ContractSoFar {
  /** The contract's first day. */
  year: string
  name?: string
  label: PeriodFigures['label']
  minutes: number
}

/** What Work's Home shows under All, and what the Home summary carries for Work: independent of any page's chosen contract. */
export interface AllFigures {
  /** Today summed over every contract that holds it. */
  today: number
  todayClients: { client: string | null; minutes: number }[]
  /** Work's week (Monday to Sunday) summed over every contract. */
  week: { minutes: number; clients: { client: string | null; minutes: number }[] }
  /** The calendar month so far (the 1st to today) summed over every contract. */
  month: number
  /** The period so far of each contract that holds today. */
  contracts: ContractSoFar[]
}

/** `years` are the shown years (`shownYear`), every contract. */
export function allFigures(years: readonly TrackingYear[], now: Moment): AllFigures {
  const day = allDay(years, now.date, now)
  const week = allWeek(years, workWeekStart(now.date), now)
  return {
    today: day.minutes,
    todayClients: mergeClients(day.contracts),
    week: { minutes: week.minutes, clients: mergeClients(week.contracts) },
    month: allMinutes(years, `${now.date.slice(0, 7)}-01`, now.date, now),
    contracts: holding(years, now.date).map((y) => {
      const f = periodFigures(y, now, 'work')
      return {
        year: y.start,
        ...(y.name ? { name: y.name } : {}),
        label: f.label,
        minutes: f.minutes
      }
    })
  }
}
