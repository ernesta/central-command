import { useToday } from '@renderer/state/use-today'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { Workspace } from '@shared/settings'
import type { TrackingYear } from '@shared/tracking/types'
import { yearToShow } from '@shared/tracking/current-year'
import { isAllContracts, type ContractScope } from '@shared/tracking/scope'
import { hasContracts } from '@shared/tracking/workspace-weeks'
import { useSettings } from './settings-context'
import { useContractFilter } from './use-contract-filter'
import { useOpenContractsRead } from './use-open-contracts'
import { useYearFile } from './use-year-file'

/**
 * The year a tracking page shows, kept in the URL (`?year=2026-09-21`, the year's start) so a link can open a
 * page on a given year. It opens on the current year; one that has no file and is not the current one falls back
 * to the current year. `data` is that year's file, null until it is read. A workspace with contracts is filtered by
 * `useContractFilter`: under one contract that is the year; under All there is no one year, and `year` is the contract
 * `contractToShow` picks, for what still needs one (Settings, a landing card). Pages that read every contract use `scope`.
 */
export function useTrackingYear(workspace: Workspace): {
  year: string
  years: string[]
  /** Whether the list of years has been read. */
  loaded: boolean
  setYear: (year: string) => void
  data: TrackingYear | null
  /** Work: All contracts, or one contract's first day. Research and Life: always All, and not used. */
  scope: ContractScope
  setScope: (scope: ContractScope) => void
} {
  const { settings } = useSettings()
  const [params, setParams] = useSearchParams()
  const filter = useContractFilter(workspace)
  const open = useOpenContractsRead(workspace)

  const contracts = hasContracts(workspace)
  const [offered, setOffered] = useState<{ workspace: Workspace; years: string[] } | null>(null)
  const years = contracts
    ? filter.loaded
      ? filter.starts
      : null
    : offered?.workspace === workspace
      ? offered.years
      : null
  // A workspace with contracts has no year but the ones made (none yet: ''); the open ones are read before choosing.
  const today = useToday()
  const current = yearToShow(workspace, today, {
    yearStarts: settings.yearStarts,
    years,
    open
  })
  const asked = params.get('year')
  const year = contracts
    ? !isAllContracts(filter.scope) && years?.includes(filter.scope)
      ? filter.scope
      : current
    : asked && years?.includes(asked)
      ? asked
      : current

  useEffect(() => {
    if (contracts) return
    let cancelled = false
    const load = (): void => {
      void window.api.tracking.years(workspace).then((list) => {
        if (!cancelled) setOffered({ workspace, years: list })
      })
    }
    load()
    const off = window.api.tracking.onChanged((event) => {
      if (event.workspace === workspace) load()
    })
    return () => {
      cancelled = true
      off()
    }
  }, [workspace, contracts])

  // Wait for the list: a year in the address that is not offered must never be asked for.
  const data = useYearFile(workspace, years === null || year === '' ? null : year)

  const setYear = (next: string): void => {
    if (contracts) {
      filter.setScope(next)
      return
    }
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('year', next)
        p.delete('week')
        return p
      },
      { replace: true }
    )
  }

  return {
    year,
    years: years ?? (current === '' ? [] : [current]),
    loaded: years !== null && (open !== null || !contracts),
    setYear,
    data,
    scope: filter.scope,
    setScope: filter.setScope
  }
}
