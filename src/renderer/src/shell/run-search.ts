import type { Person } from '@shared/people'
import {
  isSearch,
  parseSearch,
  planSources,
  resolvePeople,
  type SearchRequest
} from '@shared/search-query'
import { SEARCH_GROUP_ORDER, type SearchHit, type Searchable } from '@shared/search'
import { todayIso } from '@shared/time'

export type { Searchable }

export interface SearchGroup {
  id: string
  label: string
  hits: SearchHit[]
}

/** What a search came to: the groups of results and the lines to show about the query itself. */
export interface SearchOutcome {
  groups: SearchGroup[]
  notices: string[]
  /** The query is a search (`isSearch`): only then does an empty answer mean "No results.". */
  searched: boolean
  /** The modifiers rule everything out (two different `in:`s): the notice says so, so "No results." would only repeat it. */
  impossible: boolean
}

/** Ask every given source for its matches and keep the ones that have any, in the order the sources are given. A
 * source that fails is left out (the rest still show). */
export async function runSearches(
  plan: readonly { source: Searchable; request: SearchRequest }[],
  limit?: number
): Promise<SearchGroup[]> {
  const groups = await Promise.all(
    plan.map(async ({ source, request }): Promise<SearchGroup> => {
      try {
        return { id: source.id, label: source.label, hits: await source.search(request, limit) }
      } catch (error) {
        console.error(`Searching ${source.label} failed:`, error)
        return { id: source.id, label: source.label, hits: [] }
      }
    })
  )
  return groups.filter((g) => g.hits.length > 0)
}

/** "12 results", and when a kind was cut short, how many of each are shown at most. */
export function countResults(groups: readonly SearchGroup[], limit: number): string {
  const total = groups.reduce((n, g) => n + g.hits.length, 0)
  const text = `${total} ${total === 1 ? 'result' : 'results'}`
  return groups.some((g) => g.hits.length >= limit) ? `${text} · up to ${limit} of each kind` : text
}

function groupRank(id: string): number {
  const at = SEARCH_GROUP_ORDER.indexOf(id)
  return at < 0 ? SEARCH_GROUP_ORDER.length : at
}

const loadPeople = (): Promise<Person[]> => window.api.meetings.people.list()

/**
 * The one function the search window and the full results page both call: reads the modifiers out of `rawQuery`
 * (`docs/SEARCH_MODIFIERS_PLAN.md`), asks the sources they leave in, and puts the groups in the app's fixed order
 * (`SEARCH_GROUP_ORDER`). Nothing is searched for an empty field; modifiers alone list everything they match.
 */
export async function searchEverywhere(
  modules: readonly Searchable[],
  rawQuery: string,
  limit?: number,
  people: () => Promise<readonly Person[]> = loadPeople,
  today = todayIso()
): Promise<SearchOutcome> {
  let parsed = parseSearch(rawQuery, today)
  if (parsed.filters.some((f) => f.name === 'with' || f.name === 'by')) {
    parsed = resolvePeople(parsed, await people())
  }
  if (parsed.impossible || !isSearch(parsed)) {
    return { groups: [], notices: parsed.notices, searched: false, impossible: parsed.impossible }
  }
  const plan = planSources(parsed, modules, today)
    // The commands answer words only.
    .filter(({ source }) => source.id !== 'actions' || parsed.text.trim() !== '')
    .map(({ source, filters }) => ({ source, request: { ...parsed, filters, today } }))
  const groups = await runSearches(plan, limit)
  return {
    groups: [...groups].sort((a, b) => groupRank(a.id) - groupRank(b.id)),
    notices: parsed.notices,
    searched: true,
    impossible: false
  }
}
