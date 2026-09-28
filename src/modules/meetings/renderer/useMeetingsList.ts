import { useEffect, useState } from 'react'
import type { MeetingIndexRow, MeetingWorkspace, Person } from '../shared/types'

/**
 * Every meeting in `workspace` from the index, plus the people list. Refreshed when a meeting file
 * changes (from this app or another tool). `rows` is null until the first load.
 */
export function useMeetingsList(workspace: MeetingWorkspace): {
  rows: MeetingIndexRow[] | null
  people: Person[]
} {
  const [rows, setRows] = useState<MeetingIndexRow[] | null>(null)
  const [people, setPeople] = useState<Person[]>([])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const load = (): void => {
      void window.api.meetings.list(workspace).then((list) => {
        if (!cancelled) setRows(list)
      })
    }
    load()
    void window.api.meetings.people.list().then((list) => {
      if (!cancelled) setPeople(list)
    })
    // Several files can change at once (a sync, an import); refresh once for the burst.
    const off = window.api.meetings.onChanged(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(load, 150)
    })
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      off()
    }
  }, [workspace])

  return { rows, people }
}
