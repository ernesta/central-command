import { nextYearStart, yearLabel, yearsPresent } from '@shared/year'
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
import { fold, markdownToExcerpt } from '@shared/text'
import { formatShortDate } from '@shared/time'
import { DEFAULT_TRAINING_QUERY, haystack, queryTraining } from '../shared/rules'
import { planKey } from '../shared/plan'
import type { TrainingIndexRow, TrainingWorkspace } from '../shared/types'
import { trainingLabel } from '../shared/training-entries'
import { entryRoute, trainingPlanRoute } from './training-paths'

const DEFAULT_LIMIT = 6

/** Whether an entry passes one search filter, before negation. `with:` and `by:` are both the entry's leads. */
function trainingMatches(row: TrainingIndexRow, filter: SearchFilter, today: string): boolean {
  const value = filter.value
  switch (filter.name) {
    case 'with':
    case 'by':
      return row.leads.some((l) => fold(l) === value)
    case 'skill':
      return row.skills.some((s) => fold(s) === value)
    case 'series':
      return fold(row.series ?? '') === value
    default:
      return dateFilterMatches(filter, today, dayItem(row.date))
  }
}

/** The training entries that match, newest first: the part of the notes that matched, else the date and series. */
export function trainingHits(
  rows: readonly TrainingIndexRow[],
  people: readonly Person[],
  request: SearchRequest,
  limit = DEFAULT_LIMIT
): SearchHit[] {
  const terms = searchNeedles(request)
  return queryTraining(rows, { ...DEFAULT_TRAINING_QUERY, search: request.text }, people)
    .filter((row) => textMatches(haystack(row, people), request))
    .filter((row) => passesFilters(request.filters, (f) => trainingMatches(row, f, request.today)))
    .slice(0, limit)
    .map((row) => {
      const inTitle = terms.every((t) => fold(row.title).includes(t))
      const details = row.date ? formatShortDate(row.date) : 'No date yet'
      return {
        key: row.id,
        title: trainingLabel(row.series, row.title || 'Untitled'),
        detail: (!inTitle && snippet(row.excerpt, terms)) || details,
        route: entryRoute(row.id, row.workspace)
      }
    })
}

/** A yearly plan and its Markdown, for the search. */
export interface PlanText {
  /** The year's start date. */
  year: string
  markdown: string
}

/** The plans that match, as hits: the part of the plan that matched (there is nothing else to say about one). */
export function planHits(plans: readonly PlanText[], request: SearchRequest): SearchHit[] {
  // A plan has none of the fields a filter looks at, so only a negated filter lets it through.
  if (request.filters.some((f) => !f.negated)) return []
  const terms = searchNeedles(request)
  return plans.flatMap(({ year, markdown }) => {
    const title = `Training plan ${yearLabel(year)}`
    const text = markdownToExcerpt(markdown, Number.MAX_SAFE_INTEGER)
    if (text === '' || !textMatches(fold(`${title} ${text}`), request)) return []
    const inTitle = terms.every((t) => fold(title).includes(t))
    return [
      {
        key: `plan-${planKey(year)}`,
        title,
        detail: (!inTitle && snippet(text, terms)) || text.slice(0, 90),
        route: `${trainingPlanRoute}?year=${year}`
      }
    ]
  })
}

/** The years that can have a plan: those with entries, this one and the next (the plan page offers the same). */
export function planYears(
  dates: readonly string[],
  today: string,
  starts: readonly string[]
): string[] {
  return yearsPresent([...dates, nextYearStart(today, starts)], today, starts)
}

/** One workspace's training for the search. Only Research has plans. */
export function searchTraining(
  workspace: TrainingWorkspace
): (request: SearchRequest, limit?: number) => Promise<SearchHit[]> {
  return (request, limit = DEFAULT_LIMIT) =>
    workspace === 'research' ? searchResearch(request, limit) : searchLife(request, limit)
}

async function searchLife(request: SearchRequest, limit: number): Promise<SearchHit[]> {
  const [rows, people] = await Promise.all([
    window.api.training.list('life'),
    window.api.meetings.people.list()
  ])
  return trainingHits(rows, people, request, limit)
}

async function searchResearch(request: SearchRequest, limit: number): Promise<SearchHit[]> {
  const [rows, people, settings] = await Promise.all([
    window.api.training.list('research'),
    window.api.meetings.people.list(),
    window.api.settings.get()
  ])
  const years = planYears(
    rows.map((r) => r.date),
    request.today,
    settings.yearStarts
  )
  const plans = await Promise.all(
    years.map(async (year) => ({
      year,
      markdown: (await window.api.training.plan.read(String(planKey(year)))).content
    }))
  )
  // A plan comes first: there is at most one a year, and one that matches is probably what was wanted.
  return [...planHits(plans, request), ...trainingHits(rows, people, request, limit)].slice(
    0,
    limit
  )
}
