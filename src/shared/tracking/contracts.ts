import { formatDate } from '../time'
import { inYear } from '../year'
import { defaultClient, lastUsedClient } from './timer'
import type { TrackingYear } from './types'

/** The contracts (years) that hold a date, in the order given (newest start first from the store). */
export function holding(years: readonly TrackingYear[], date: string): TrackingYear[] {
  return years.filter((y) => inYear(date, y.start, y.weeks))
}

/** The contract among `years` that holds `date` and has `client` (exact name, as the plan spells it). */
export function contractForClient(
  years: readonly TrackingYear[],
  date: string,
  client: string
): TrackingYear | undefined {
  return holding(years, date).find((y) => (y.plan.clients ?? []).includes(client))
}

/** The client of a task's list: the list's name when it is a client of a contract holding `date`. */
export function clientForList(
  years: readonly TrackingYear[],
  date: string,
  list: string
): string | undefined {
  return holding(years, date)
    .flatMap((y) => y.plan.clients ?? [])
    .find((c) => c.toLowerCase() === list.trim().toLowerCase())
}

/**
 * The contract a timer or an entry with no client goes to: the one of the client used last (the latest session or typed
 * entry across the contracts that hold `date`), else the first one given.
 */
export function contractOfLastClient(
  years: readonly TrackingYear[],
  date: string
): TrackingYear | undefined {
  const open = holding(years, date)
  let best: { year: TrackingYear; at: string } | null = null
  for (const year of open) {
    const used = lastUsedClient(year)
    if (used && (best === null || used.at > best.at)) best = { year, at: used.at }
  }
  return best?.year ?? open[0]
}

/** What the timer can start for: one contract that holds today and the clients it has. */
export interface OpenContract {
  /** The contract's start (its file). */
  year: string
  name?: string
  clients: string[]
}

/** Everything the timer can start for on a day: the contracts with clients, and the client used last (the preselected one). */
export interface OpenContracts {
  contracts: OpenContract[]
  last?: string
}

export function openContracts(years: readonly TrackingYear[], date: string): OpenContracts {
  const contracts = holding(years, date)
    .filter((y) => (y.plan.clients ?? []).length > 0)
    .map((y) => ({
      year: y.start,
      ...(y.name ? { name: y.name } : {}),
      clients: y.plan.clients ?? []
    }))
  const last = contractOfLastClient(
    holding(years, date).filter((y) => (y.plan.clients ?? []).length > 0),
    date
  )
  const client = last && defaultClient(last)
  return { contracts, ...(client ? { last: client } : {}) }
}

/** A contract as the timer's menus name it: its name, else its first day. */
export function contractName(contract: OpenContract | undefined): string {
  return contract?.name ?? (contract ? `From ${formatDate(contract.year)}` : '')
}

/** The contract that has a client among the open ones (the year to add typed time to). */
export function yearOfClient(open: readonly OpenContract[], client: string): string | undefined {
  return open.find((c) => c.clients.includes(client))?.year
}

/**
 * The contract the Hours page opens on. Among the contracts that hold today (`open`): the one last shown if it is
 * among them, else the one of the client used last, else the newest start. With none holding today: the newest one that
 * has started, else the newest. `years` are the starts, newest first; '' when there are none.
 */
export function contractToShow(
  years: readonly string[],
  today: string,
  open: OpenContracts,
  remembered?: string
): string {
  const holding = open.contracts.map((c) => c.year).filter((y) => years.includes(y))
  if (holding.length > 0) {
    if (remembered && holding.includes(remembered)) return remembered
    const ofLast = open.contracts.find((c) => c.year && c.clients.includes(open.last ?? ''))
    if (ofLast && holding.includes(ofLast.year)) return ofLast.year
    return [...holding].sort().reverse()[0]
  }
  return years.find((y) => y <= today) ?? years[0] ?? ''
}
