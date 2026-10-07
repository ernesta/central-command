import { useEffect, useMemo, useState } from 'react'
import type { RunningTimer } from '@shared/tracking/api'
import type { Session } from '@shared/tracking/types'
import { todayIso } from '@shared/time'
import { useMeetingEntries } from '../../hours/renderer/useMeetingHours'
import {
  occupiedByMeetings,
  occupiedBySessions,
  overlapping,
  type Occupied
} from '../shared/meeting-entries'
import type { MeetingMeta, MeetingWorkspace } from '../shared/types'

/**
 * What else is on the clock when a meeting is: the timer and typed blocks of its workspace for its day (and the timer if it runs
 * elsewhere), and the other meetings that have a task. Pure rules in `overlapping`; this only reads and says.
 */
export function useMeetingClashes(
  workspace: MeetingWorkspace,
  id: string,
  meta: Pick<MeetingMeta, 'date' | 'start' | 'end'>
): Occupied[] {
  const [sessions, setSessions] = useState<{ date: string; list: Session[] } | null>(null)
  const [running, setRunning] = useState<RunningTimer | null>(null)
  const entries = useMeetingEntries(workspace, todayIso())
  const { date } = meta

  useEffect(() => {
    if (!date) return
    let cancelled = false
    const load = (): void => {
      void (async () => {
        const years = await window.api.tracking.years(workspace)
        const files = await Promise.all(years.map((y) => window.api.tracking.get(workspace, y)))
        const run = await window.api.tracking.running()
        if (cancelled) return
        setSessions({ date, list: files.flatMap((f) => f.sessions.filter((s) => s.date === date)) })
        setRunning(run)
      })()
    }
    load()
    const off = window.api.tracking.onChanged(load)
    return () => {
      cancelled = true
      off()
    }
  }, [workspace, date])

  return useMemo(() => {
    if (!date || !meta.start || !meta.end) return []
    const own = sessions?.date === date ? sessions.list : []
    // The timer that runs in the other workspace is on the same clock.
    const elsewhere =
      running && running.workspace !== workspace && running.session.date === date
        ? [running.session]
        : []
    const now = new Date()
    const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
    return overlapping(
      meta.start,
      meta.end,
      [
        ...occupiedBySessions([...own, ...elsewhere], date),
        ...occupiedByMeetings(entries, date, workspace)
      ],
      seconds,
      `${workspace}/${id}`
    )
  }, [sessions, running, entries, workspace, id, date, meta.start, meta.end])
}
