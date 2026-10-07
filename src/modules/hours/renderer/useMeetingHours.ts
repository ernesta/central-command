import { useEffect, useMemo, useState } from 'react'
import { withDerived, type DerivedEntry } from '@shared/tracking/derived'
import type { TrackingYear } from '@shared/tracking/types'
import { meetingEntries, type TaskInfo } from '../../meetings/shared/meeting-entries'
import type { MeetingIndexRow } from '../../meetings/shared/types'
import { lectureEntries } from '../../training/shared/lecture-entries'
import type { TrainingIndexRow } from '../../training/shared/types'
import { useWorkClients } from '../../tasks/renderer/useWorkClients'
import type { Task } from '../../tasks/shared/types'
import type { HoursWorkspace } from '../shared/workspaces'

/**
 * A workspace's meetings, training notes and tasks, read again whenever any changes, and from them the hours they derive
 * (`meetingEntries`, and in Research `lectureEntries`: a lecture's own session). Nothing is stored: this is the notes' date, start
 * and end every time.
 */
export function useMeetingEntries(workspace: HoursWorkspace, today: string): DerivedEntry[] {
  const [loaded, setLoaded] = useState<{
    workspace: HoursWorkspace
    rows: MeetingIndexRow[]
    lectures: TrainingIndexRow[]
    tasks: Task[]
  } | null>(null)
  const clients = useWorkClients(workspace)

  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      void Promise.all([
        window.api.meetings.list(workspace),
        workspace === 'research' ? window.api.training.list('research') : Promise.resolve([]),
        window.api.tasks.list(workspace)
      ]).then(([rows, lectures, tasks]) => {
        if (!cancelled) setLoaded({ workspace, rows, lectures, tasks })
      })
    }
    load()
    const offMeetings = window.api.meetings.onChanged(load)
    const offTraining = window.api.training.onChanged(load)
    const offTasks = window.api.tasks.onChanged((event) => {
      if (event.workspace === workspace) load()
    })
    return () => {
      cancelled = true
      offMeetings()
      offTraining()
      offTasks()
    }
  }, [workspace])

  return useMemo(() => {
    if (!loaded || loaded.workspace !== workspace) return []
    const byUid = new Map(loaded.tasks.map((t) => [t.uid, t]))
    const taskOf = (uid: string): TaskInfo | null => {
      const task = byUid.get(uid)
      if (!task) return null
      // A subtask sits in its parent's list.
      const list = task.list || (task.parentUid ? (byUid.get(task.parentUid)?.list ?? '') : '')
      return { title: task.title, list }
    }
    return [
      ...meetingEntries(loaded.rows, taskOf, today, clients),
      ...lectureEntries(loaded.lectures, (uid) => taskOf(uid), today)
    ]
  }, [loaded, workspace, today, clients])
}

/** The year as the Hours page shows it: its own entries, plus the hours its meetings derive. Null while the year is not read. */
export function useShownYear(
  workspace: HoursWorkspace,
  data: TrackingYear | null,
  today: string
): TrackingYear | null {
  const entries = useMeetingEntries(workspace, today)
  return useMemo(() => (data ? withDerived(data, entries) : null), [data, entries])
}

/** Every one of the given year files as shown, each with the hours its meetings derive. */
export function useShownYears(
  workspace: HoursWorkspace,
  files: TrackingYear[] | null,
  today: string
): TrackingYear[] | null {
  const entries = useMeetingEntries(workspace, today)
  return useMemo(() => (files ? files.map((f) => withDerived(f, entries)) : null), [files, entries])
}
