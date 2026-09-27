import { parseSearchQuery, SEARCH_GROUP_ORDER, type SearchHit } from '@shared/search'

export interface SearchGroup {
  id: string
  label: string
  hits: SearchHit[]
}

export interface Searchable {
  id: string
  label: string
  /** `limit` is how many of the best matches to return; each source's own default (usually 6) when left out. */
  search: (query: string, limit?: number) => Promise<SearchHit[]>
}

/** Ask every given source for its matches and keep the ones that have any, in the order the sources are given. A
 * source that fails is left out (the rest still show). */
export async function runSearches(
  modules: readonly Searchable[],
  query: string,
  limit?: number
): Promise<SearchGroup[]> {
  const groups = await Promise.all(
    modules.map(async (m): Promise<SearchGroup> => {
      try {
        return { id: m.id, label: m.label, hits: await m.search(query, limit) }
      } catch (error) {
        console.error(`Searching ${m.label} failed:`, error)
        return { id: m.id, label: m.label, hits: [] }
      }
    })
  )
  return groups.filter((g) => g.hits.length > 0)
}

function groupRank(id: string): number {
  const at = SEARCH_GROUP_ORDER.indexOf(id)
  return at < 0 ? SEARCH_GROUP_ORDER.length : at
}

/**
 * The one function the search window and the full results page both call: parses `in:` modifiers out of
 * `rawQuery`, searches only the sources they name (everything, with none), and puts the groups in the app's
 * fixed order (`SEARCH_GROUP_ORDER`). Nothing is searched for a plain empty query; `in:meetings` alone lists
 * everything in Meetings, since a source was still named.
 */
export async function searchEverywhere(
  modules: readonly Searchable[],
  rawQuery: string,
  limit?: number
): Promise<SearchGroup[]> {
  const { sources, text } = parseSearchQuery(rawQuery)
  if (sources === null && text.trim() === '') return []
  const chosen = sources ? modules.filter((m) => sources.includes(m.id)) : modules
  const groups = await runSearches(chosen, text, limit)
  return [...groups].sort((a, b) => groupRank(a.id) - groupRank(b.id))
}
