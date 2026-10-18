import { useEffect, useState } from 'react'
import { lectureTaskUid } from '../shared/lecture-entries'

const NONE: ReadonlySet<string> = new Set()

/**
 * The uids of Research's lecture tasks (each training note's own `task:`): the sessions, whose time is typed in the note. Nothing may
 * be started on them or have time added; a lecture's hours go to its self-study task. Read again when the notes change.
 */
export function useLectureTaskUids(): ReadonlySet<string> {
  const [uids, setUids] = useState<ReadonlySet<string>>(NONE)
  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      void window.api.training.list('research').then((rows) => {
        if (cancelled) return
        const next = new Set<string>()
        for (const row of rows) {
          const uid = lectureTaskUid(row.task)
          if (uid) next.add(uid)
        }
        setUids(next)
      })
    }
    load()
    const off = window.api.training.onChanged((event) => {
      if (event.ref.workspace === 'research') load()
    })
    return () => {
      cancelled = true
      off()
    }
  }, [])
  return uids
}
