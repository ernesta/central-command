import { CalendarDays, User } from 'lucide-react'
import { findByName, type Person } from '@shared/people'
import { searchTerms } from '@shared/search'
import { fold } from '@shared/text'
import { meetingHeading } from '@shared/time'
import type { EntityProvider } from '@renderer/entities/registry'
import { DEFAULT_MEETINGS_QUERY, queryMeetings } from '../shared/query'
import { MEETING_WORKSPACES, type MeetingIndexRow } from '../shared/types'
import { meetingRoute, personRoute } from './meetings-paths'

const WORKSPACE_LABEL = { research: 'Research', work: 'Work' } as const

/**
 * Every meeting of every workspace, from the index. A run of lookups (the mentions of one note) asks within a moment of
 * each other, so the answer is reused for a couple of seconds rather than fetched once per mention.
 */
let cached: { at: number; rows: Promise<MeetingIndexRow[]> } | null = null
function allMeetings(): Promise<MeetingIndexRow[]> {
  if (!cached || Date.now() - cached.at > 2000) {
    cached = {
      at: Date.now(),
      rows: Promise.all(MEETING_WORKSPACES.map((w) => window.api.meetings.list(w))).then((lists) =>
        lists.flat()
      )
    }
  }
  return cached.rows
}

/** People a note can mention: by name (renaming a person rewrites the mentions, see `renamePersonMentions`). */
export const personEntities: EntityProvider = {
  kind: 'person',
  heading: 'People',
  noun: 'person',
  icon: User,
  async search(query, limit) {
    const people = await window.api.meetings.people.list()
    const terms = searchTerms(query)
    return people
      .filter((p) => !p.archived)
      .filter((p) => terms.every((t) => fold(`${p.name} ${p.initials}`).includes(t)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((person: Person) => ({
        id: person.name,
        title: person.name,
        detail: person.initials,
        label: person.name,
        prepare: async () => ({ kind: 'person' as const, key: person.name })
      }))
  },
  async copy(key) {
    return { text: key }
  },
  async resolve(key) {
    const person = findByName(await window.api.meetings.people.list(), key)
    if (!person) return null
    return {
      title: person.name,
      detail: person.archived ? `${person.initials} · archived` : person.initials,
      route: personRoute(person.name)
    }
  }
}

/** Meetings a note can mention, in either workspace, by the `uid` in their front matter. */
export const meetingEntities: EntityProvider = {
  kind: 'meeting',
  heading: 'Meetings',
  noun: 'meeting',
  icon: CalendarDays,
  async search(query, limit, self) {
    const [rows, people] = await Promise.all([allMeetings(), window.api.meetings.people.list()])
    return queryMeetings(rows, { ...DEFAULT_MEETINGS_QUERY, search: query }, people)
      .filter(
        (row) =>
          !(self?.kind === 'meeting' && self.workspace === row.workspace && self.id === row.id)
      )
      .slice(0, limit)
      .map((row) => {
        const title = meetingHeading(row.series, row.date)
        return {
          id: `${row.workspace}/${row.id}`,
          title,
          detail: `${row.attendees.slice(0, 3).join(', ') || 'No attendees'} · ${WORKSPACE_LABEL[row.workspace]}`,
          label: title,
          prepare: async () => ({
            kind: 'meeting' as const,
            key: await window.api.meetings.ensureUid({ workspace: row.workspace, id: row.id })
          })
        }
      })
  },
  async resolve(key) {
    const row = (await allMeetings()).find((r) => r.uid === key)
    if (!row) return null
    return {
      title: meetingHeading(row.series, row.date),
      detail: `${row.attendees.slice(0, 3).join(', ') || 'No attendees'} · ${WORKSPACE_LABEL[row.workspace]}`,
      route: meetingRoute(row.workspace, row.id)
    }
  }
}
