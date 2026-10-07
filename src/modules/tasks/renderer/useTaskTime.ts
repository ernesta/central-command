import { useEffect, useMemo, useState } from 'react'
import { useNow } from '@renderer/state/use-now'
import { useRunningTimer } from '@renderer/state/use-running-timer'
import { todayIso } from '@shared/time'
import { inYear } from '@shared/year'
import { withDerived } from '@shared/tracking/derived'
import { clientForList, contractForClient } from '@shared/tracking/contracts'
import type { TrackingYear } from '@shared/tracking/types'
import { useMeetingEntries } from '../../hours/renderer/useMeetingHours'
import { elapsedMinutes } from '../../hours/shared/timer'
import { hoursByMonth, taskUidOf, trackedByTask } from '../shared/tracked'
import type { TaskWorkspace } from '../shared/types'

/**
 * What Hours holds for each task of a workspace (minutes by task uid, every year, a running timer counted in whole minutes, and the
 * hours its meetings and lectures derive, the same minutes the Hours page counts) and which task has a timer running. Read again whenever a year file changes. ClickUp's earlier time is not here (it is on the task).
 */
export function useTaskTime(workspace: TaskWorkspace): {
  tracked: ReadonlyMap<string, number>
  running: ReadonlySet<string>
  /**
   * The start of the year file that covers a date, or null when none does (to add time on that day). With overlapping
   * contracts, the one that has `client`.
   */
  yearFor: (date: string, client?: string) => string | null
  /** A task's list as the client of a contract that holds `date`, when its name is one. */
  clientFor: (list: string, date: string) => string | undefined
  /** A task's hours by month, history included. */
  months: (uid: string) => { month: string; minutes: number }[]
} {
  const [years, setYears] = useState<TrackingYear[]>([])
  const { running } = useRunningTimer()
  const now = useNow(false)
  const entries = useMeetingEntries(workspace, todayIso())
  const shown = useMemo(() => years.map((y) => withDerived(y, entries)), [years, entries])

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

  const base = useMemo(() => trackedByTask(shown), [shown])
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
    const yearFor = (date: string, client?: string): string | null =>
      (client ? contractForClient(years, date, client) : undefined)?.start ??
      years.find((y) => inYear(date, y.start, y.weeks))?.start ??
      null
    const clientFor = (list: string, date: string): string | undefined =>
      clientForList(years, date, list)
    const months = (uid: string): { month: string; minutes: number }[] => hoursByMonth(shown, uid)
    return { tracked, running: active, yearFor, clientFor, months }
  }, [base, running, now, workspace, years, shown])
}
