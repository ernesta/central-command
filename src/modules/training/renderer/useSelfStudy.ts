import { useEffect, useMemo, useState } from 'react'
import type { TrackingYear } from '@shared/tracking/types'
import { trackedByTask } from '../../tasks/shared/tracked'
import type { SelfStudy } from '../shared/rules'

/**
 * The minutes Hours holds on each task (by uid) in Research, from the real year files only: a lecture's self-study, its timers and
 * typed time. The lecture's own session is not here (it comes from the note). Read again whenever a year file changes.
 */
export function useSelfStudy(): SelfStudy {
  const [years, setYears] = useState<TrackingYear[]>([])
  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      void window.api.tracking.years('research').then(async (starts) => {
        const all = await Promise.all(starts.map((s) => window.api.tracking.get('research', s)))
        if (!cancelled) setYears(all)
      })
    }
    load()
    const off = window.api.tracking.onChanged((event) => {
      if (event.workspace === 'research') load()
    })
    return () => {
      cancelled = true
      off()
    }
  }, [])
  return useMemo(() => trackedByTask(years), [years])
}
