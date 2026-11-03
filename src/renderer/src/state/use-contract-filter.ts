import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { Workspace } from '@shared/settings'
import {
  ALL_CONTRACTS,
  isAllContracts,
  validScope,
  type ContractScope
} from '@shared/tracking/scope'
import { hasContracts } from '@shared/tracking/workspace-weeks'
import { createScopeStore, useRememberedScope } from './remembered-scope'
import { useYearFile } from './use-year-file'

const store = createScopeStore('work-contract')

/** For tests: forget the held choice so the next caller reads the settings again. */
export function resetRememberedScope(): void {
  store.set(null)
}

/**
 * Work's one contract filter (`docs/WORK_CONTRACT_FILTER_PLAN.md`): every Work page shows All contracts or one contract, chosen
 * once, in the top bar, and remembered. A link with `?year=<start>` (or `all`) sets it for that visit; choosing in the selector
 * remembers the choice. It opens on All. `starts` are the contracts' first days, newest first. Every caller shares the one
 * choice. For a workspace with no contracts it does nothing (`applies` false).
 */
export function useContractFilter(workspace: Workspace): {
  applies: boolean
  scope: ContractScope
  setScope: (scope: ContractScope) => void
  starts: string[]
  /** Whether the contracts have been read. */
  loaded: boolean
} {
  const applies = hasContracts(workspace)
  const [params, setParams] = useSearchParams()
  const remembered = useRememberedScope(store, ALL_CONTRACTS)
  const [offered, setOffered] = useState<{ workspace: Workspace; years: string[] } | null>(null)

  useEffect(() => {
    if (!applies) return
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
  }, [workspace, applies])

  const starts = offered?.workspace === workspace ? offered.years : null
  const asked = params.get('year')
  // Until the contracts are read the choice is taken as given; then one that no longer exists falls back to All.
  const wanted = asked ?? remembered.scope
  const scope = !applies
    ? ALL_CONTRACTS
    : starts === null
      ? wanted
      : (validScope(asked, starts) ?? validScope(remembered.scope, starts) ?? ALL_CONTRACTS)

  const { remember } = remembered
  const setScope = useCallback(
    (next: ContractScope): void => {
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

  return { applies, scope, setScope, starts: starts ?? [], loaded: starts !== null }
}

/**
 * The filter for a page that narrows a list by the chosen contract's clients (Tasks): the filter itself, and `clients`, the
 * contract's clients under one contract, `undefined` under All (nothing is narrowed) and for a workspace with no contracts.
 * `ready` is false while a chosen contract's file is being read: the page waits rather than show every task meanwhile.
 */
export function useContractScope(workspace: Workspace): ReturnType<typeof useContractFilter> & {
  clients: readonly string[] | undefined
  ready: boolean
} {
  const filter = useContractFilter(workspace)
  const one = filter.applies && !isAllContracts(filter.scope) && filter.loaded
  const data = useYearFile(workspace, one ? filter.scope : null)
  return {
    ...filter,
    clients: one ? (data?.plan.clients ?? []) : undefined,
    ready: !one || data !== null
  }
}
