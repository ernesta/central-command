import type { Workspace } from '@shared/settings'
import { ALL_CONTRACTS, isAllContracts, type ContractScope } from '@shared/tracking/scope'
import { contractLabel, hasContracts } from '@shared/tracking/workspace-weeks'
import { YEAR_WEEKS, yearLabel } from '@shared/year'
import { useTrackingYear } from './use-tracking-year'
import { useYear } from './use-year'

/** The period a list page (Meetings) shows: the academic year, or in Work the contract (its first day, length and name). */
export interface Period {
  /** The period's first day: the year's start, or the contract's. '' while Work has no contract. */
  year: string
  years: string[]
  setYear: (year: string) => void
  /** Work: All contracts, or one contract's first day (the workspace's one filter). Research and Life: always All, unused. */
  scope: ContractScope
  setScope: (scope: ContractScope) => void
  /** Work under All: every Work meeting, no one period. `year`, `weeks` and `end` are then of no use. */
  all: boolean
  /** Its length in report weeks. */
  weeks: number
  /** A contract's real last day; undefined for the academic year (and while Work has no contract). */
  end: string | undefined
  /** A Work contract's clients (its task lists); undefined for the academic year. */
  clients: readonly string[] | undefined
  /** How a sentence names it: "2026–27", or "Luminos · 1 May 2026 – 29 Oct 2026". */
  label: string
  /** The contract's length and name for the PDF export; undefined for the academic year. */
  contract: { weeks: number; end?: string; label: string } | undefined
  /** False while a contract's file is being read: the page shows nothing rather than a wrong list. */
  loaded: boolean
}

/**
 * Research and Life keep the academic year; Work's choice is always a contract (`docs/CONTRACTS_PLAN.md`: they may overlap,
 * each has its own first and last day). Both hooks run so that the order never changes; only the one that fits is used.
 */
export function usePeriod(workspace: Workspace, dates: readonly string[], today: string): Period {
  const academic = useYear(dates, today)
  const tracked = useTrackingYear(workspace)
  if (!hasContracts(workspace)) {
    return {
      ...academic,
      scope: ALL_CONTRACTS,
      setScope: () => {},
      all: false,
      weeks: YEAR_WEEKS,
      end: undefined,
      clients: undefined,
      label: yearLabel(academic.year),
      contract: undefined,
      loaded: true
    }
  }
  const all = isAllContracts(tracked.scope)
  const weeks = tracked.data?.weeks
  const label = all
    ? 'all contracts'
    : tracked.year === ''
      ? 'any contract'
      : contractLabel(tracked.year, weeks, tracked.data?.name, tracked.data?.end)
  return {
    year: tracked.year,
    years: tracked.years,
    setYear: tracked.setYear,
    scope: tracked.scope,
    setScope: tracked.setScope,
    all,
    weeks: weeks ?? 0,
    end: tracked.data?.end,
    // Under All no contract's clients narrow the list.
    clients: all ? undefined : (tracked.data?.plan.clients ?? []),
    label,
    contract:
      all || weeks === undefined
        ? undefined
        : { weeks, ...(tracked.data?.end ? { end: tracked.data.end } : {}), label },
    loaded: tracked.loaded && (all || tracked.year === '' || tracked.data !== null)
  }
}
