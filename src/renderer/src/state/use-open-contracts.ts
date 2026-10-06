import { useEffect, useState } from 'react'
import type { Workspace } from '@shared/settings'
import type { OpenContract } from '@shared/tracking/contracts'

/**
 * The contracts that hold today with their clients (Work; none for Research), read again whenever a year file changes
 * and when the day turns. Empty until read.
 */
export function useOpenContracts(workspace: Workspace): OpenContract[] {
  const [loaded, setLoaded] = useState<{ workspace: Workspace; list: OpenContract[] } | null>(null)
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
  return loaded?.workspace === workspace ? loaded.list : []
}
