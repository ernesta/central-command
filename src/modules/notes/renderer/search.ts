import { isoDate } from '@shared/dates'
import { searchTerms, snippet, type SearchHit } from '@shared/search'
import { fold } from '@shared/text'
import { formatShortDate } from '@shared/time'
import { groupLabel } from '../shared/groups'
import { DEFAULT_NOTES_QUERY, displayTitle, queryNotes } from '../shared/query'
import type { NoteIndexRow, NoteWorkspace } from '../shared/types'
import { noteRoute } from './notes-paths'

const DEFAULT_LIMIT = 6

/** The notes that match, most recently edited first: the part of the text that matched, else the group and date. */
export function noteHits(
  rows: readonly NoteIndexRow[],
  query: string,
  limit = DEFAULT_LIMIT
): SearchHit[] {
  const terms = searchTerms(query)
  return queryNotes(rows, { ...DEFAULT_NOTES_QUERY, search: query })
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
): (query: string, limit?: number) => Promise<SearchHit[]> {
  return async (query, limit) => noteHits(await window.api.notes.list(workspace), query, limit)
}
