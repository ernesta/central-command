import type { Person } from '@shared/people'
import { snippet, type SearchHit } from '@shared/search'
import { dayItem } from '@shared/search-dates'
import {
  dateFilterMatches,
  passesFilters,
  searchNeedles,
  textMatches,
  type SearchFilter,
  type SearchRequest
} from '@shared/search-query'
import { fold } from '@shared/text'
import { meetingHeading } from '@shared/time'
import { DEFAULT_MEETINGS_QUERY, haystack, queryMeetings } from '../shared/query'
import type { MeetingIndexRow, MeetingWorkspace } from '../shared/types'
import { meetingRoute } from './meetings-paths'

const DEFAULT_LIMIT = 6

/** Whether a meeting passes one search filter, before negation. `has:todos` means a TODO still open. */
function meetingMatches(row: MeetingIndexRow, filter: SearchFilter, today: string): boolean {
  const value = filter.value
  switch (filter.name) {
    case 'with':
      return row.attendees.some((a) => fold(a) === value)
    case 'skill':
      return row.skills.some((s) => fold(s) === value)
    case 'series':
      return fold(row.series) === value
    case 'has':
      return value === 'todos' ? row.todos.some((t) => !t.done) : row.summary.trim() !== ''
    default:
      return dateFilterMatches(filter, today, dayItem(row.date))
  }
}

/** The meetings that match, newest first: the part of the notes that matched, else the summary. */
export function meetingHits(
  rows: readonly MeetingIndexRow[],
  people: readonly Person[],
  request: SearchRequest,
  limit = DEFAULT_LIMIT
): SearchHit[] {
  const terms = searchNeedles(request)
  return queryMeetings(rows, { ...DEFAULT_MEETINGS_QUERY, search: request.text }, people)
    .filter((row) => textMatches(haystack(row, people), request))
    .filter((row) => passesFilters(request.filters, (f) => meetingMatches(row, f, request.today)))
    .slice(0, limit)
    .map((row) => {
      const title = meetingHeading(row.series, row.date)
      const inTitle = terms.every((t) => fold(title).includes(t))
      return {
        key: row.id,
        title,
        detail: (!inTitle && snippet(row.excerpt, terms)) || row.summary || 'No summary yet.',
        route: meetingRoute(row.workspace, row.id)
      }
    })
}

export function searchMeetings(
  workspace: MeetingWorkspace
): (request: SearchRequest, limit?: number) => Promise<SearchHit[]> {
  return async (request, limit) => {
    const [rows, people] = await Promise.all([
      window.api.meetings.list(workspace),
      window.api.meetings.people.list()
    ])
    return meetingHits(rows, people, request, limit)
  }
}
