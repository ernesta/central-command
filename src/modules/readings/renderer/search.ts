import { modulePath } from '@modules/types'
import { searchTerms, snippet, type SearchHit } from '@shared/search'
import { fold } from '@shared/text'
import { DEFAULT_READINGS_QUERY } from '../shared/query'
import type { Reading } from '../shared/types'

const DEFAULT_LIMIT = 6
const readingsBase = modulePath({ workspace: 'research', id: 'readings' })

/** The readings for the search, as hits: the part of the notes that matched, else the short citation. */
export function readingHits(
  readings: readonly Reading[],
  query: string,
  limit = DEFAULT_LIMIT
): SearchHit[] {
  const terms = searchTerms(query)
  return readings.slice(0, limit).map((reading) => {
    const inTitle = terms.every((t) => fold(reading.fullTitle).includes(t))
    return {
      key: reading.citekey,
      title: reading.fullTitle,
      detail: (!inTitle && snippet(reading.notesExcerpt, terms)) || reading.shortCitation,
      route: `${readingsBase}/${encodeURIComponent(reading.citekey)}`
    }
  })
}

export async function searchReadings(query: string, limit?: number): Promise<SearchHit[]> {
  const readings = await window.api.readings.list({ ...DEFAULT_READINGS_QUERY, search: query })
  return readingHits(readings, query, limit)
}
