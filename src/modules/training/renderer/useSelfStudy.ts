import { useEffect, useMemo, useState } from 'react'
import type { TrackingYear } from '@shared/tracking/types'
import { trackedByTask } from '../../tasks/shared/tracked'
import type { TaskWorkspace } from '../../tasks/shared/types'
import type { SelfStudy } from '../shared/rules'

/**
 * The minutes Hours holds on each task (by uid) in a workspace, from the real year files only: a training's self-study, its timers and
 * typed time. The training's own session is not here (it comes from the note). Read again whenever a year file changes.
 */
export function useSelfStudy(workspace: TaskWorkspace = 'research'): SelfStudy {
  const [years, setYears] = useState<TrackingYear[]>([])
  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      void window.api.tracking.years(workspace).then(async (starts) => {
        const all = await Promise.all(starts.map((s) => window.api.tracking.get(workspace, s)))
        if (!cancelled) setYears(all)
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
  return useMemo(() => trackedByTask(years), [years])
}
