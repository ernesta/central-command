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
import { useModuleState } from './use-module-state'
import { useYearFile } from './use-year-file'

/** The scope last chosen for Work: `all`, or a contract's first day. */
interface RememberedScope {
  scope: string
}

function normaliseScope(raw: unknown): RememberedScope {
  const scope = (raw as { scope?: unknown } | undefined)?.scope
  return { scope: typeof scope === 'string' && scope !== '' ? scope : ALL_CONTRACTS }
}

/**
 * Work's one contract filter (`docs/WORK_CONTRACT_FILTER_PLAN.md`): every Work page shows All contracts or one contract, chosen
 * once and remembered. A link with `?year=<start>` (or `all`) sets it for that visit; choosing in the selector remembers the
 * choice. It opens on All. `starts` are the contracts' first days, newest first. Call it once per page and pass what it gives down:
 * two calls would each hold their own copy of the choice. For a workspace with no contracts it does nothing (`applies` false).
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
  const remembered = useModuleState('work-contract', normaliseScope)
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
  const wanted = asked ?? remembered.value.scope
  const scope = !applies
    ? ALL_CONTRACTS
    : starts === null
      ? wanted
      : (validScope(asked, starts) ?? validScope(remembered.value.scope, starts) ?? ALL_CONTRACTS)

  const { update } = remembered
  const setScope = useCallback(
    (next: ContractScope): void => {
      if (applies) update({ scope: next })
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
    [applies, update, setParams]
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
