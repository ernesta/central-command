import { isoDate } from '@shared/dates'
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
import { formatShortDate } from '@shared/time'
import { groupLabel } from '../shared/groups'
import { DEFAULT_NOTES_QUERY, displayTitle, haystack, queryNotes } from '../shared/query'
import type { NoteIndexRow, NoteWorkspace } from '../shared/types'
import { noteRoute } from './notes-paths'

const DEFAULT_LIMIT = 6

/** Whether a note passes one search filter, before negation: `with:` is a person named in the note, dates are the day it was last edited. */
function noteMatches(row: NoteIndexRow, filter: SearchFilter, today: string): boolean {
  if (filter.name === 'with') return fold(`${row.title}\n${row.excerpt}`).includes(filter.value)
  return dateFilterMatches(filter, today, dayItem(isoDate(row.edited)))
}

/** The notes that match, most recently edited first: the part of the text that matched, else the group and date. */
export function noteHits(
  rows: readonly NoteIndexRow[],
  request: SearchRequest,
  limit = DEFAULT_LIMIT
): SearchHit[] {
  const terms = searchNeedles(request)
  return queryNotes(rows, { ...DEFAULT_NOTES_QUERY, search: request.text })
    .filter((row) => textMatches(haystack(row), request))
    .filter((row) => passesFilters(request.filters, (f) => noteMatches(row, f, request.today)))
    .slice(0, limit)
    .map((row) => {
      const title = displayTitle(row)
      const inTitle = terms.every((t) => fold(title).includes(t))
      const details = `${groupLabel(row.group, row.subgroup) || 'Ungrouped'} · ${formatShortDate(isoDate(row.edited))}`
      return {
        key: row.id,
        title,
        detail: (!inTitle && snippet(row.excerpt, terms)) || details,
        route: noteRoute(row.workspace, row.id)
      }
    })
}

export function searchNotes(
  workspace: NoteWorkspace
): (request: SearchRequest, limit?: number) => Promise<SearchHit[]> {
  return async (request, limit) => noteHits(await window.api.notes.list(workspace), request, limit)
}
