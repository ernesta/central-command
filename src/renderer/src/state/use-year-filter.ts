import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { Workspace } from '@shared/settings'
import {
  ALL_YEARS,
  offeredYears,
  singleYear,
  validYearScope,
  type YearScope
} from '@shared/year-scope'
import { createScopeStore, useRememberedScope } from './remembered-scope'
import { useSettings } from './settings-context'
import { useToday } from './use-today'

/** The workspaces that have one academic year filter: Research. Work has its contract filter; Life keeps a selector on each page. */
export const YEAR_FILTER_WORKSPACES: readonly Workspace[] = ['research']

const store = createScopeStore('research-year')

/** For tests: forget the held choice so the next caller reads the settings again. */
export function resetRememberedYear(): void {
  store.set(null)
}

/**
 * Research's one academic year filter (`docs/RESEARCH_YEAR_FILTER_PLAN.md`): every Research page shows All years or one year, chosen
 * once, in the top bar, and remembered. A link with `?year=<start>` (or `all`) sets it for that visit; choosing in the selector
 * remembers the choice. It opens on All years. `years` are the years on offer, newest first (`offeredYears`). Every caller shares the
 * one choice; a remembered year that is no longer on offer falls back to All. In another workspace it does nothing (`applies` false).
 */
export function useYearFilter(workspace: Workspace): {
  applies: boolean
  scope: YearScope
  setScope: (scope: YearScope) => void
  years: string[]
  /** The year a page that can only mean one year uses: the chosen year, or the current year under All. */
  year: string
  /** Whether the years on offer have been read. */
  loaded: boolean
} {
  const applies = YEAR_FILTER_WORKSPACES.includes(workspace)
  const { settings } = useSettings()
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const remembered = useRememberedScope(store, ALL_YEARS)
  const [files, setFiles] = useState<{ workspace: Workspace; years: string[] } | null>(null)

  // The years with an Hours file are offered too, in case they are older than the first listed start.
  useEffect(() => {
    if (!applies) return
    let cancelled = false
    const load = (): void => {
      void window.api.tracking.years(workspace).then((list) => {
        if (!cancelled) setFiles({ workspace, years: list })
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
  }, [workspace, applies])

  const read = files?.workspace === workspace ? files.years : null
  const years = applies ? offeredYears(today, settings.yearStarts, read ?? []) : []
  const asked = params.get('year')
  // Until the files are read the choice is taken as given; then one that is no longer on offer falls back to All.
  const wanted = asked ?? remembered.scope
  const scope = !applies
    ? ALL_YEARS
    : read === null
      ? wanted
      : (validYearScope(asked, years) ?? validYearScope(remembered.scope, years) ?? ALL_YEARS)

  const { remember } = remembered
  const setScope = useCallback(
    (next: YearScope): void => {
      if (applies) remember(next)
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('year', next)
          p.delete('week')
          return p
        },
        { replace: true }
      )
    },
    [applies, remember, setParams]
  )

  return {
    applies,
    scope,
    setScope,
    years,
    year: singleYear(scope, today, settings.yearStarts),
    loaded: !applies || read !== null
  }
}
