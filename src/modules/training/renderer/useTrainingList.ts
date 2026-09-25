import { useEffect, useState } from 'react'
import type { Person } from '@shared/people'
import type { MeetingIndexRow } from '@modules/meetings/shared/types'
import type { TrainingIndexRow } from '../shared/types'

/**
 * Every training entry in the Research workspace from the index, the meetings (for the hours of
 * meetings beside the total) and the people list. Refreshed when an entry file changes. `rows` is null
 * until the first load.
 */
export function useTrainingList(): {
  rows: TrainingIndexRow[] | null
  meetings: MeetingIndexRow[]
  people: Person[]
} {
  const [rows, setRows] = useState<TrainingIndexRow[] | null>(null)
  const [meetings, setMeetings] = useState<MeetingIndexRow[]>([])
  const [people, setPeople] = useState<Person[]>([])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const load = (): void => {
      void window.api.training.list('research').then((list) => {
        if (!cancelled) setRows(list)
      })
    }
    load()
    void window.api.meetings.list('research').then((list) => {
      if (!cancelled) setMeetings(list)
    })
    void window.api.meetings.people.list().then((list) => {
      if (!cancelled) setPeople(list)
    })
    // Several files can change at once (an import); refresh once for the burst.
    const off = window.api.training.onChanged(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(load, 150)
    })
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      off()
    }
  }, [])

  return { rows, meetings, people }
}
