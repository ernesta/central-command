import { useEffect, useMemo, useState } from 'react'
import { useNow } from '@renderer/state/use-now'
import { useRunningTimer } from '@renderer/state/use-running-timer'
import { todayIso } from '@shared/time'
import { inContract } from '@shared/tracking/workspace-weeks'
import { withDerived } from '@shared/tracking/derived'
import { clientForList, contractForClient } from '@shared/tracking/contracts'
import type { TrackingYear } from '@shared/tracking/types'
import { useMeetingEntries } from '../../hours/renderer/useMeetingHours'
import { elapsedMinutes } from '../../hours/shared/timer'
import { hoursByMonth, taskUidOf, trackedByTask, undatedEarlier } from '../shared/tracked'
import type { TaskWorkspace } from '../shared/types'
import { useTasksList } from './useTasksList'

/**
 * What Hours holds for each task of a workspace (minutes by task uid, every year, a running timer counted in whole minutes, and the
 * hours its meetings and trainings derive, the same minutes the Hours page counts) and which task has a timer running. Read again whenever a year file changes. ClickUp's earlier time is not here (it is on the task).
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
  /** The hours of these tasks (a task and its subtasks) by month, history included. */
  months: (uids: readonly string[]) => { month: string; minutes: number }[]
  /** These tasks' ClickUp time with no known day: what their months do not already show. */
  earlier: (tasks: readonly { uid: string; earlierMinutes: number }[]) => number
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

  const { tasks } = useTasksList(workspace)
  // Each task's ClickUp time, so history marked `earlier` that it does not hold still counts on its page.
  const base = useMemo(
    () => trackedByTask(shown, new Map((tasks ?? []).map((t) => [t.uid, t.earlierMinutes]))),
    [shown, tasks]
  )
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
      years.find((y) => inContract(date, y))?.start ??
      null
    const clientFor = (list: string, date: string): string | undefined =>
      clientForList(years, date, list)
    const months = (uids: readonly string[]): { month: string; minutes: number }[] => {
      const byMonth = new Map<string, number>()
      for (const uid of uids)
        for (const m of hoursByMonth(shown, uid))
          byMonth.set(m.month, (byMonth.get(m.month) ?? 0) + m.minutes)
      return [...byMonth]
        .map(([month, minutes]) => ({ month, minutes }))
        .sort((x, y) => x.month.localeCompare(y.month))
    }
    const earlier = (parts: readonly { uid: string; earlierMinutes: number }[]): number =>
      parts.reduce((sum, t) => sum + undatedEarlier(shown, t.uid, t.earlierMinutes), 0)
    return { tracked, running: active, yearFor, clientFor, months, earlier }
  }, [base, running, now, workspace, years, shown])
}
