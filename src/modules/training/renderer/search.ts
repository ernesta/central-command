import type { Person } from '@shared/people'
import { searchTerms, snippet, type SearchHit } from '@shared/search'
import { fold } from '@shared/text'
import { formatShortDate } from '@shared/time'
import { DEFAULT_TRAINING_QUERY, queryTraining } from '../shared/rules'
import type { TrainingIndexRow } from '../shared/types'
import { entryRoute } from './training-paths'

const LIMIT = 6

/** The training entries that match, newest first: the part of the notes that matched, else the date and series. */
export function trainingHits(
  rows: readonly TrainingIndexRow[],
  people: readonly Person[],
  query: string
): SearchHit[] {
  const terms = searchTerms(query)
  return queryTraining(rows, { ...DEFAULT_TRAINING_QUERY, search: query }, people)
    .slice(0, LIMIT)
    .map((row) => {
      const inTitle = terms.every((t) => fold(row.title).includes(t))
      const details = [row.date ? formatShortDate(row.date) : 'No date yet', row.series]
        .filter(Boolean)
        .join(' · ')
      return {
        key: row.id,
        title: row.title || 'Untitled',
        detail: (!inTitle && snippet(row.excerpt, terms)) || details,
        route: entryRoute(row.id)
      }
    })
}

export async function searchTraining(query: string): Promise<SearchHit[]> {
  const [rows, people] = await Promise.all([
    window.api.training.list('research'),
    window.api.meetings.people.list()
  ])
  return trainingHits(rows, people, query)
}
