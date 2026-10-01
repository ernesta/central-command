import { useEffect, useState } from 'react'
import type { RunningTimer } from '@shared/tracking/api'

/** The one running timer of the whole app (any workspace, any year), read again whenever a year file changes. Null when none runs. */
export function useRunningTimer(): { running: RunningTimer | null; loaded: boolean } {
  const [state, setState] = useState<{ running: RunningTimer | null; loaded: boolean }>({
    running: null,
    loaded: false
  })

  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      void window.api.tracking.running().then((running) => {
        if (!cancelled) setState({ running, loaded: true })
      })
    }
    load()
    const off = window.api.tracking.onChanged(load)
    return () => {
      cancelled = true
      off()
    }
  }, [])

  return state
}
