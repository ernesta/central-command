import { useEffect, useState } from 'react'
import type { WatchSource } from '../shared/types'

/** Watch's sources (null until read), read again after every check or change. */
export function useWatchSources(): { sources: WatchSource[] | null; reload: () => void } {
  const [sources, setSources] = useState<WatchSource[] | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    void window.api.watch.sources
      .list()
      .then((next) => {
        if (!cancelled) setSources(next)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [tick])

  useEffect(() => window.api.watch.onChanged(() => setTick((n) => n + 1)), [])

  return { sources, reload: () => setTick((n) => n + 1) }
}
