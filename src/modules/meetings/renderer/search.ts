import type { Person } from '@shared/people'
import { searchTerms, snippet, type SearchHit } from '@shared/search'
import { fold } from '@shared/text'
import { meetingHeading } from '@shared/time'
import { DEFAULT_MEETINGS_QUERY, queryMeetings } from '../shared/query'
import type { MeetingIndexRow } from '../shared/types'
import { meetingRoute } from './meetings-paths'

const DEFAULT_LIMIT = 6

/** The meetings that match, newest first: the part of the notes that matched, else the summary. */
export function meetingHits(
  rows: readonly MeetingIndexRow[],
  people: readonly Person[],
  query: string,
  limit = DEFAULT_LIMIT
): SearchHit[] {
  const terms = searchTerms(query)
  return queryMeetings(rows, { ...DEFAULT_MEETINGS_QUERY, search: query }, people)
    .slice(0, limit)
    .map((row) => {
      const title = meetingHeading(row.series, row.date)
      const inTitle = terms.every((t) => fold(title).includes(t))
      return {
        key: row.id,
        title,
        detail: (!inTitle && snippet(row.excerpt, terms)) || row.summary || 'No summary yet.',
        route: meetingRoute(row.id)
      }
    })
}

export async function searchMeetings(query: string, limit?: number): Promise<SearchHit[]> {
  const [rows, people] = await Promise.all([
    window.api.meetings.list('research'),
    window.api.meetings.people.list()
  ])
  return meetingHits(rows, people, query, limit)
}
