import { useEffect, useState } from 'react'
import { todayIso } from '@shared/time'
import { DEFAULT_TRAINING_QUERY, queryTraining } from '@modules/training/shared/rules'
import type { TrainingIndexRow } from '@modules/training/shared/types'
import { DEFAULT_MEETINGS_QUERY, queryMeetings } from '../shared/query'
import { MEETING_WORKSPACES, type MeetingIndexRow, type Person } from '../shared/types'

export interface PersonProfile {
  person: Person | null
  /** This person's meetings, newest first (undated ones first, as the meetings list shows them). */
  meetings: MeetingIndexRow[]
  /** This person's trainings, newest first. */
  trainings: TrainingIndexRow[]
  /** The most recent past meeting with them, if any. */
  lastMet: MeetingIndexRow | null
  /** The nearest upcoming meeting with them, if any. */
  nextMeeting: MeetingIndexRow | null
}

const EMPTY: PersonProfile = {
  person: null,
  meetings: [],
  trainings: [],
  lastMet: null,
  nextMeeting: null
}

/** Everything a person's own page shows, from the lists the app already keeps. */
export function usePersonProfile(name: string): {
  profile: PersonProfile
  loading: boolean
  /** Re-reads everything: call after a change made on this page itself (adding a link). */
  refresh: () => void
} {
  // Keyed by the name and the reload count that produced it, so switching to a different person (or the
  // initial load, or a refresh) reads as "loading" without a synchronous setState at the top of the effect.
  const [found, setFound] = useState<{
    name: string
    reload: number
    profile: PersonProfile
  } | null>(null)
  const [reload, setReload] = useState(0)
  const loading = found?.name !== name || found.reload !== reload

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [people, meetingRowsByWorkspace, trainingRows] = await Promise.all([
        window.api.meetings.people.list(),
        Promise.all(MEETING_WORKSPACES.map((w) => window.api.meetings.list(w))),
        window.api.training.list('research')
      ])
      if (cancelled) return
      // Every workspace's meetings, merged: a person is the same person whichever workspace met them.
      const meetingRows = meetingRowsByWorkspace.flat()
      const person = people.find((p) => p.name === name) ?? null

      const meetings = queryMeetings(
        meetingRows,
        { ...DEFAULT_MEETINGS_QUERY, attendee: name },
        people
      )
      const trainings = queryTraining(
        trainingRows,
        { ...DEFAULT_TRAINING_QUERY, lead: name },
        people
      )

      const today = todayIso()
      const past = meetings.filter((m) => m.date !== '' && m.date <= today)
      const upcoming = meetings.filter((m) => m.date !== '' && m.date > today)
      const lastMet = past[0] ?? null // meetings is already newest first
      const nextMeeting = upcoming.length > 0 ? upcoming[upcoming.length - 1] : null

      setFound({
        name,
        reload,
        profile: { person, meetings, trainings, lastMet, nextMeeting }
      })
    })()
    return () => {
      cancelled = true
    }
  }, [name, reload])

  const profile = found?.name === name && found.reload === reload ? found.profile : EMPTY
  return { profile, loading, refresh: () => setReload((r) => r + 1) }
}
