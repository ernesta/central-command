import { useEffect, useState } from 'react'
import type { HoursWorkspace } from '../../hours/shared/workspaces'
import { noteSpans, type NoteSpan } from '../../training/shared/note-clashes'

/**
 * Every meeting and training note of a workspace that has a date and both times, read again whenever any changes. Unlike the
 * hours entries it needs no task and no date in the past: a clash is a clash before it happens.
 */
export function useNoteSpans(workspace: HoursWorkspace): NoteSpan[] {
  const [loaded, setLoaded] = useState<{ workspace: HoursWorkspace; spans: NoteSpan[] } | null>(
    null
  )

  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      void Promise.all([
        // Work has meetings only and Life has training only.
        workspace === 'life' ? Promise.resolve([]) : window.api.meetings.list(workspace),
        workspace === 'work' ? Promise.resolve([]) : window.api.training.list(workspace)
      ]).then(([meetings, trainings]) => {
        if (!cancelled) setLoaded({ workspace, spans: noteSpans(meetings, trainings) })
      })
    }
    load()
    const offMeetings = window.api.meetings.onChanged(load)
    const offTraining = window.api.training.onChanged(load)
    return () => {
      cancelled = true
      offMeetings()
      offTraining()
    }
  }, [workspace])

  return loaded?.workspace === workspace ? loaded.spans : []
}
