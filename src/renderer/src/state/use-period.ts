import type { Workspace } from '@shared/settings'
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
  /** Its length in report weeks. */
  weeks: number
  /** A contract's real last day; undefined for the academic year (and while Work has no contract). */
  end: string | undefined
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
      weeks: YEAR_WEEKS,
      end: undefined,
      label: yearLabel(academic.year),
      contract: undefined,
      loaded: true
    }
  }
  const weeks = tracked.data?.weeks
  const label =
    tracked.year === ''
      ? 'any contract'
      : contractLabel(tracked.year, weeks, tracked.data?.name, tracked.data?.end)
  return {
    year: tracked.year,
    years: tracked.years,
    setYear: tracked.setYear,
    weeks: weeks ?? 0,
    end: tracked.data?.end,
    label,
    contract:
      weeks === undefined
        ? undefined
        : { weeks, ...(tracked.data?.end ? { end: tracked.data.end } : {}), label },
    loaded: tracked.loaded && (tracked.year === '' || tracked.data !== null)
  }
}
