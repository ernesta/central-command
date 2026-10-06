import { useEffect, useState } from 'react'
import type { Workspace } from '@shared/settings'
import type { OpenContracts } from '@shared/tracking/contracts'

const NONE: OpenContracts = { contracts: [] }

/**
 * The contracts that hold today with their clients (Work; none for Research), read again whenever a year file changes
 * and when the day turns. Empty until read.
 */
export function useOpenContracts(workspace: Workspace): OpenContracts {
  return useOpenContractsRead(workspace) ?? NONE
}

/** The same, null until it has been read (a page that must not guess before it knows). */
export function useOpenContractsRead(workspace: Workspace): OpenContracts | null {
  const [loaded, setLoaded] = useState<{ workspace: Workspace; list: OpenContracts } | null>(null)
  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      void window.api.tracking.openContracts(workspace).then((list) => {
        if (!cancelled) setLoaded({ workspace, list })
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
  return loaded?.workspace === workspace ? loaded.list : null
}
