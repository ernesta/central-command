import { searchTerms, snippet, type SearchHit } from '@shared/search'
import { fold } from '@shared/text'
import { displayTitle, queryLists } from '@modules/reading-lists/shared/query'
import type { ReadingListIndexRow } from '@modules/reading-lists/shared/types'
import { readingListRoute } from './reading-lists-paths'

const DEFAULT_LIMIT = 6

/** The reading lists that match, most recently edited first: the part of the text that matched, else the section and entry counts. */
export function readingListHits(
  rows: readonly ReadingListIndexRow[],
  query: string,
  limit = DEFAULT_LIMIT
): SearchHit[] {
  const terms = searchTerms(query)
  return queryLists(rows, query)
    .slice(0, limit)
    .map((row) => {
      const title = displayTitle(row)
      const inTitle = terms.every((t) => fold(title).includes(t))
      const details = `${row.sectionCount} ${row.sectionCount === 1 ? 'section' : 'sections'} · ${row.entryCount} ${row.entryCount === 1 ? 'entry' : 'entries'}`
      return {
        key: row.id,
        title,
        detail: (!inTitle && snippet(row.excerpt, terms)) || details,
        route: readingListRoute(row.id)
      }
    })
}

export async function searchReadingLists(query: string, limit?: number): Promise<SearchHit[]> {
  return readingListHits(await window.api.readingLists.list('research'), query, limit)
}
