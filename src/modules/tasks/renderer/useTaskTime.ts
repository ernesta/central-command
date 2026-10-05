import { useEffect, useMemo, useState } from 'react'
import { useNow } from '@renderer/state/use-now'
import { useRunningTimer } from '@renderer/state/use-running-timer'
import { inYear } from '@shared/year'
import type { TrackingYear } from '@shared/tracking/types'
import { elapsedMinutes } from '../../hours/shared/timer'
import { taskUidOf, trackedByTask } from '../shared/tracked'
import type { TaskWorkspace } from '../shared/types'

/**
 * What Hours holds for each task of a workspace (minutes by task uid, every year, a running timer counted in whole minutes) and
 * which task has a timer running. Read again whenever a year file changes. ClickUp's earlier time is not here (it is on the task).
 */
export function useTaskTime(workspace: TaskWorkspace): {
  tracked: ReadonlyMap<string, number>
  running: ReadonlySet<string>
  /** The start of the year file that covers a date, or null when none does (to add time on that day). */
  yearFor: (date: string) => string | null
} {
  const [years, setYears] = useState<TrackingYear[]>([])
  const { running } = useRunningTimer()
  const now = useNow(false)

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

  const base = useMemo(() => trackedByTask(years), [years])
  return useMemo(() => {
    const tracked = new Map(base)
    const active = new Set<string>()
    if (running && running.workspace === workspace) {
      const uid = taskUidOf(running.session.task)
      if (uid) {
        active.add(uid)
        const minutes = now ? elapsedMinutes(running.session, now) : null
        if (minutes) tracked.set(uid, (tracked.get(uid) ?? 0) + minutes)
      }
    }
    const yearFor = (date: string): string | null =>
      years.find((y) => inYear(date, y.start, y.weeks))?.start ?? null
    return { tracked, running: active, yearFor }
  }, [base, running, now, workspace, years])
}
