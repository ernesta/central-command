import { modulePath } from '@modules/types'
import { snippet, type SearchHit } from '@shared/search'
import { yearItem } from '@shared/search-dates'
import {
  dateFilterMatches,
  passesFilters,
  searchNeedles,
  textMatches,
  type SearchFilter,
  type SearchRequest
} from '@shared/search-query'
import { fold } from '@shared/text'
import { DEFAULT_READINGS_QUERY } from '../shared/query'
import type { Author, Reading } from '../shared/types'

const DEFAULT_LIMIT = 6
const readingsBase = modulePath({ workspace: 'research', id: 'readings' })

/**
 * Whether an author is the person with this folded full name: the same name, or the same family name with the same first
 * letter of the given name (Zotero often has only "Rastle, K.").
 */
export function isAuthor(author: Author, name: string): boolean {
  if ('literal' in author) return fold(author.literal) === name
  const given = fold(author.given ?? '')
  const family = fold(author.family)
  if (`${given} ${family}`.trim() === name) return true
  const words = name.split(' ')
  return given !== '' && family === words[words.length - 1] && given[0] === words[0][0]
}

/** Whether a reading passes one search filter, before negation. */
function readingMatches(reading: Reading, filter: SearchFilter, today: string): boolean {
  const value = filter.value
  switch (filter.name) {
    case 'with':
    case 'by':
      return reading.authors.some((a) => isAuthor(a, value))
    case 'status':
      return reading.status === (value === 'read' ? 'read' : 'to_read')
    case 'tag':
      return reading.tags.some((t) => fold(t) === value)
    case 'has':
      return reading.hasNotes
    default:
      return dateFilterMatches(filter, today, yearItem(reading.year))
  }
}

function text(reading: Reading): string {
  return fold(
    [
      reading.fullTitle,
      reading.shortCitation,
      reading.authors
        .map((a) => ('literal' in a ? a.literal : `${a.given ?? ''} ${a.family}`))
        .join(' '),
      reading.tags.join(' '),
      reading.notesExcerpt
    ].join('\n')
  )
}

/** The readings for the search, as hits: the part of the notes that matched, else the short citation. */
export function readingHits(
  readings: readonly Reading[],
  request: SearchRequest,
  limit = DEFAULT_LIMIT
): SearchHit[] {
  const terms = searchNeedles(request)
  return (
    readings
      // Plain words were already matched by the list; a phrase has to be found here.
      .filter(
        (r) =>
          request.phrases.length === 0 ||
          textMatches(text(r), { text: '', phrases: request.phrases })
      )
      .filter((r) => passesFilters(request.filters, (f) => readingMatches(r, f, request.today)))
      .slice(0, limit)
      .map((reading) => {
        const inTitle = terms.every((t) => fold(reading.fullTitle).includes(t))
        return {
          key: reading.citekey,
          title: reading.fullTitle,
          detail: (!inTitle && snippet(reading.notesExcerpt, terms)) || reading.shortCitation,
          route: `${readingsBase}/${encodeURIComponent(reading.citekey)}`
        }
      })
  )
}

export async function searchReadings(request: SearchRequest, limit?: number): Promise<SearchHit[]> {
  const readings = await window.api.readings.list({
    ...DEFAULT_READINGS_QUERY,
    search: request.text
  })
  return readingHits(readings, request, limit)
}
