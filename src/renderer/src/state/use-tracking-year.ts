import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { Workspace } from '@shared/settings'
import type { TrackingYear } from '@shared/tracking/types'
import { currentYear } from '@shared/year'
import { todayIso } from '@shared/time'
import { useSettings } from './settings-context'
import { useYearFile } from './use-year-file'

/**
 * The year a tracking page shows, kept in the URL (`?year=2026-09-21`, the year's start) so a link can open a
 * page on a given year. It opens on the current year; one that has no file and is not the current one falls back
 * to the current year. `data` is that year's file, null until it is read.
 */
export function useTrackingYear(workspace: Workspace): {
  year: string
  years: string[]
  setYear: (year: string) => void
  data: TrackingYear | null
} {
  const { settings } = useSettings()
  const [params, setParams] = useSearchParams()
  const [offered, setOffered] = useState<{ workspace: Workspace; years: string[] } | null>(null)

  const current = currentYear(todayIso(), settings.yearStarts)
  const years = offered?.workspace === workspace ? offered.years : null
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
  const data = useYearFile(workspace, years === null ? null : year)

  const setYear = (next: string): void =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('year', next)
        return p
      },
      { replace: true }
    )

  return { year, years: years ?? [current], setYear, data }
}
