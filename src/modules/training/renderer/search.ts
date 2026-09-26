import {
  academicYearLabel,
  academicYearRange,
  academicYearsPresent,
  currentAcademicYear
} from '@shared/academic-year'
import type { Person } from '@shared/people'
import { searchTerms, snippet, type SearchHit } from '@shared/search'
import { fold, markdownToExcerpt } from '@shared/text'
import { formatShortDate, todayIso } from '@shared/time'
import { DEFAULT_TRAINING_QUERY, queryTraining } from '../shared/rules'
import type { TrainingIndexRow } from '../shared/types'
import { entryRoute, trainingPlanRoute } from './training-paths'

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

/** A yearly plan and its Markdown, for the search. */
export interface PlanText {
  year: number
  markdown: string
}

/** The plans that match, as hits: the part of the plan that matched (there is nothing else to say about one). */
export function planHits(plans: readonly PlanText[], query: string): SearchHit[] {
  const terms = searchTerms(query)
  return plans.flatMap(({ year, markdown }) => {
    const title = `Training plan ${academicYearLabel(year)}`
    const text = markdownToExcerpt(markdown, Number.MAX_SAFE_INTEGER)
    const haystack = fold(`${title} ${text}`)
    if (text === '' || !terms.every((t) => haystack.includes(t))) return []
    const inTitle = terms.every((t) => fold(title).includes(t))
    return [
      {
        key: `plan-${year}`,
        title,
        detail: (!inTitle && snippet(text, terms)) || text.slice(0, 90),
        route: `${trainingPlanRoute}?year=${year}`
      }
    ]
  })
}

/** The academic years that can have a plan: those with entries, this one and the next (the plan page offers the same). */
export function planYears(dates: readonly string[], today: string): number[] {
  const next = academicYearRange(currentAcademicYear(today) + 1).from
  return academicYearsPresent([...dates, next], today)
}

export async function searchTraining(query: string): Promise<SearchHit[]> {
  const [rows, people] = await Promise.all([
    window.api.training.list('research'),
    window.api.meetings.people.list()
  ])
  const years = planYears(
    rows.map((r) => r.date),
    todayIso()
  )
  const plans = await Promise.all(
    years.map(async (year) => ({
      year,
      markdown: (await window.api.training.plan.read(String(year))).content
    }))
  )
  // A plan comes first: there is at most one a year, and one that matches is probably what was wanted.
  return [...planHits(plans, query), ...trainingHits(rows, people, query)].slice(0, LIMIT)
}
