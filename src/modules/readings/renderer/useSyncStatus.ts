import { useCallback, useEffect, useState } from 'react'
import type { ReadingCounts, SyncStatus } from '../shared/types'

interface SyncInfo {
  status: SyncStatus | null
  counts: ReadingCounts | null
  syncNow: () => Promise<void>
}

/** Live sync status and reading counts. Counts refresh whenever the status changes. */
export function useSyncStatus(): SyncInfo {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [counts, setCounts] = useState<ReadingCounts | null>(null)

  useEffect(() => {
    let cancelled = false
    const refresh = (next: SyncStatus): void => {
      if (cancelled) return
      setStatus(next)
      void window.api.readings.counts().then((c) => !cancelled && setCounts(c))
    }
    void window.api.readings.sync.status().then(refresh)
    const off = window.api.readings.sync.onStatus(refresh)
    return () => {
      cancelled = true
      off()
    }
  }, [])

  const syncNow = useCallback(async () => {
    await window.api.readings.sync.now()
  }, [])

  return { status, counts, syncNow }
}
