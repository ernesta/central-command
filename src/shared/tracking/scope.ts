import { addDays, daysBetween, weekdayOf } from '../year'
import { holding } from './contracts'
import { minutesByClient, minutesByDate } from './totals'
import { contractEnd, inContract } from './workspace-weeks'
import type { Moment, TrackingYear } from './types'

/**
 * What Work's pages are filtered by: every contract, or one contract by its first day (its file). One scope for the whole
 * workspace (`docs/WORK_CONTRACT_FILTER_PLAN.md`).
 */
export type ContractScope = 'all' | string

export const ALL_CONTRACTS = 'all'

export const isAllContracts = (scope: ContractScope): boolean => scope === ALL_CONTRACTS

/** A remembered or addressed scope that is still valid: `all`, or the start of a contract that exists; else null. */
export function validScope(raw: unknown, starts: readonly string[]): ContractScope | null {
  if (raw === ALL_CONTRACTS) return ALL_CONTRACTS
  return typeof raw === 'string' && starts.includes(raw) ? raw : null
}

/**
 * The contracts a scope covers on a date. All: every contract that holds the date. One contract: that one, when it holds the
 * date. `years` must be the shown years (`withDerived`), so a meeting's hours count.
 */
export function scopeYears(
  years: readonly TrackingYear[],
  scope: ContractScope,
  date: string
): TrackingYear[] {
  return isAllContracts(scope)
    ? holding(years, date)
    : years.filter((y) => y.start === scope && inContract(date, y))
}

/** Work's week under All is Monday to Sunday (the user's rule): contracts may start on any weekday, so none of their grids is the week. */
export const WORK_WEEK_START_DAY = 1

/** The first day (a Monday) of Work's week that holds a date. */
export function workWeekStart(date: string): string {
  return addDays(date, -((weekdayOf(date) - WORK_WEEK_START_DAY + 7) % 7))
}

/** One contract's share of a day or a week: its hours, and per client those that have time. */
export interface ContractShare {
  /** The contract's first day. */
  year: string
  name?: string
  minutes: number
  clients: { client: string | null; minutes: number }[]
}

const shareOf = (y: TrackingYear, from: string, to: string, now: Moment): ContractShare => {
  const clients = minutesByClient(y, from, to, now)
  return {
    year: y.start,
    ...(y.name ? { name: y.name } : {}),
    minutes: clients.reduce((n, c) => n + c.minutes, 0),
    clients
  }
}

export interface AllDay {
  date: string
  minutes: number
  /** Every contract that holds the date, newest first as given. */
  contracts: ContractShare[]
}

/** A day under All: the hours of every contract that holds it, summed, and each contract's by client. */
export function allDay(years: readonly TrackingYear[], date: string, now: Moment): AllDay {
  const contracts = holding(years, date).map((y) => shareOf(y, date, date, now))
  return { date, minutes: contracts.reduce((n, c) => n + c.minutes, 0), contracts }
}

export interface AllWeek {
  /** The week's first day (a Monday). */
  from: string
  to: string
  minutes: number
  days: { date: string; minutes: number }[]
  /** Every contract with a day in the week. */
  contracts: ContractShare[]
}

/** Whether a contract has a day between two dates. */
const overlaps = (y: TrackingYear, from: string, to: string): boolean =>
  y.start <= to && contractEnd(y) >= from

/** Work's week under All: the hours of every contract, each day counted only inside the contract that holds it. */
export function allWeek(years: readonly TrackingYear[], from: string, now: Moment): AllWeek {
  const to = addDays(from, 6)
  const inWeek = years.filter((y) => overlaps(y, from, to))
  const maps = inWeek.map((y) => minutesByDate(y, now))
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(from, i)
    return { date, minutes: maps.reduce((n, m) => n + (m.get(date) ?? 0), 0) }
  })
  const contracts = inWeek.map((y) => shareOf(y, from, to, now))
  return { from, to, minutes: days.reduce((n, d) => n + d.minutes, 0), days, contracts }
}

/**
 * Every contract as one read-only year, for the charts under All: it starts on the Monday of the earliest first day and ends on the
 * latest last day, holds every contract's sessions, typed time and imported days, and has no aim, clients or days off. A day inside no
 * contract has no time, so the gaps read as empty days. Never saved. `years` must be the shown years. Null with none.
 */
export function mergedYear(years: readonly TrackingYear[]): TrackingYear | null {
  if (years.length === 0) return null
  const start = workWeekStart(years.map((y) => y.start).sort()[0])
  const end = years.map(contractEnd).sort().reverse()[0]
  const days: TrackingYear['days'] = {}
  // Only a contract's own days: time dated outside its span belongs to no contract (as in `allDay` and `allWeek`).
  const own = <T extends { date: string }>(y: TrackingYear, list: T[]): T[] =>
    list.filter((e) => inContract(e.date, y))
  for (const y of years)
    for (const [date, d] of Object.entries(y.days).filter(([date]) => inContract(date, y)))
      days[date] = { ...d, minutes: (days[date]?.minutes ?? 0) + (d.minutes ?? 0) }
  return {
    version: 1,
    start,
    weeks: Math.ceil((daysBetween(start, end) + 1) / 7),
    end,
    plan: { hoursPerWeek: 0, workDays: [1, 2, 3, 4, 5, 6, 7], allowanceDays: 0, weekAim: true },
    carryIn: 0,
    sessions: years.flatMap((y) => own(y, y.sessions)),
    adjusts: years.flatMap((y) => own(y, y.adjusts)),
    days,
    timeOff: [],
    weekDays: {}
  }
}

/** The first and last Work weeks any contract touches: the bounds of the week arrows under All. Null with no contract. */
export function weekBounds(years: readonly TrackingYear[]): { first: string; last: string } | null {
  if (years.length === 0) return null
  const starts = years.map((y) => y.start).sort()
  const ends = years.map(contractEnd).sort()
  return { first: workWeekStart(starts[0]), last: workWeekStart(ends[ends.length - 1]) }
}

/** The week under All that a page opens on or is asked for: a valid week start inside the bounds, else today's, else the nearest bound. */
export function resolveAllWeek(
  asked: string | null,
  years: readonly TrackingYear[],
  today: string
): string {
  const bounds = weekBounds(years)
  const current = workWeekStart(today)
  if (!bounds) return current
  const fits = (w: string): boolean => w >= bounds.first && w <= bounds.last
  if (asked && workWeekStart(asked) === asked && fits(asked)) return asked
  if (fits(current)) return current
  return current < bounds.first ? bounds.first : bounds.last
}
