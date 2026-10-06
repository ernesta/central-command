import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { Workspace } from '@shared/settings'
import type { TrackingYear } from '@shared/tracking/types'
import { contractToShow } from '@shared/tracking/contracts'
import { hasContracts } from '@shared/tracking/workspace-weeks'
import { currentYear } from '@shared/year'
import { todayIso } from '@shared/time'
import { useSettings } from './settings-context'
import { useModuleState } from './use-module-state'
import { useOpenContractsRead } from './use-open-contracts'
import { useYearFile } from './use-year-file'

/** The contract last shown, per workspace. */
interface RememberedContracts {
  shown: Record<string, string>
}

function normaliseContracts(raw: unknown): RememberedContracts {
  const shown = (raw as { shown?: unknown } | undefined)?.shown
  const out: Record<string, string> = {}
  if (shown && typeof shown === 'object')
    for (const [key, value] of Object.entries(shown))
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) out[key] = value
  return { shown: out }
}

/**
 * The year a tracking page shows, kept in the URL (`?year=2026-09-21`, the year's start) so a link can open a
 * page on a given year. It opens on the current year; one that has no file and is not the current one falls back
 * to the current year. `data` is that year's file, null until it is read. A workspace with contracts opens on the
 * one that holds today and was shown or used last (`contractToShow`); the last one chosen is remembered.
 */
export function useTrackingYear(workspace: Workspace): {
  year: string
  years: string[]
  /** Whether the list of years has been read. */
  loaded: boolean
  setYear: (year: string) => void
  data: TrackingYear | null
} {
  const { settings } = useSettings()
  const [params, setParams] = useSearchParams()
  const [offered, setOffered] = useState<{ workspace: Workspace; years: string[] } | null>(null)
  const open = useOpenContractsRead(workspace)
  const remembered = useModuleState('hours-contract', normaliseContracts)

  const years = offered?.workspace === workspace ? offered.years : null
  // A workspace with contracts has no year but the ones made (none yet: ''); the open ones are read before choosing.
  const today = todayIso()
  const current = hasContracts(workspace)
    ? years && open
      ? contractToShow(years, today, open, remembered.value.shown[workspace])
      : ''
    : currentYear(today, settings.yearStarts)
  const asked = params.get('year')
  const year = asked && years?.includes(asked) ? asked : current

  useEffect(() => {
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
  }, [workspace])

  // Wait for the list: a year in the address that is not offered must never be asked for.
  const data = useYearFile(workspace, years === null || year === '' ? null : year)

  const setYear = (next: string): void => {
    if (hasContracts(workspace))
      remembered.update({ shown: { ...remembered.value.shown, [workspace]: next } })
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
    loaded: years !== null && (open !== null || !hasContracts(workspace)),
    setYear,
    data
  }
}
