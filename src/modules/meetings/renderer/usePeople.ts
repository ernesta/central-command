import { useCallback, useEffect, useState } from 'react'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import type { PeopleResult } from '../shared/api'
import type { PersonUsage } from '../shared/people-usage'
import type { Person } from '../shared/types'

export interface PeopleActionResult {
  /** The message of a refused change, or null when it went through. */
  error: string | null
  /** Note files left as they were because they changed while a change was being written into them. */
  skipped: string[]
}

/** The people list with how many notes mention each person, and one way to change them that keeps both fresh. */
export function usePeople(): {
  people: Person[] | null
  usage: PersonUsage[]
  run: (action: Promise<Person[] | PeopleResult>) => Promise<PeopleActionResult>
} {
  const [people, setPeople] = useState<Person[] | null>(null)
  const [usage, setUsage] = useState<PersonUsage[]>([])

  useEffect(() => {
    let cancelled = false
    void Promise.all([window.api.meetings.people.list(), window.api.meetings.people.usage()]).then(
      ([list, counts]) => {
        if (cancelled) return
        setPeople(list)
        setUsage(counts)
      }
    )
    return () => {
      cancelled = true
    }
  }, [])

  const run = useCallback(
    async (action: Promise<Person[] | PeopleResult>): Promise<PeopleActionResult> => {
      try {
        const result = await action
        setPeople(Array.isArray(result) ? result : result.people)
        setUsage(await window.api.meetings.people.usage())
        return { error: null, skipped: Array.isArray(result) ? [] : result.report.skipped }
      } catch (error) {
        return { error: ipcErrorMessage(error), skipped: [] }
      }
    },
    []
  )

  return { people, usage, run }
}
