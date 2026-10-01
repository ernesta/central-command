import { useEffect, useState } from 'react'
import type { Workspace } from '@shared/settings'
import type { TrackingYear } from '@shared/tracking/types'

/**
 * One year's file for one workspace, read again whenever it changes (this window, another window or the timer).
 * Null until it is read, and while `year` is null (not asked for yet).
 */
export function useYearFile(workspace: Workspace, year: string | null): TrackingYear | null {
  const [loaded, setLoaded] = useState<{ key: string; data: TrackingYear } | null>(null)
  const key = `${workspace}/${year}`

  useEffect(() => {
    if (year === null) return
    let cancelled = false
    const load = (): void => {
      void window.api.tracking.get(workspace, year).then((data) => {
        if (!cancelled) setLoaded({ key: `${workspace}/${year}`, data })
      })
    }
    load()
    const off = window.api.tracking.onChanged((event) => {
      if (event.workspace === workspace && event.year === year) load()
    })
    return () => {
      cancelled = true
      off()
    }
  }, [workspace, year])

  return year !== null && loaded?.key === key ? loaded.data : null
}
