import type { SearchHit } from '@shared/search'

export interface SearchGroup {
  id: string
  label: string
  hits: SearchHit[]
}

export interface Searchable {
  id: string
  label: string
  search: (query: string) => Promise<SearchHit[]>
}

/**
 * Ask every module for its matches and keep the ones that have any, in the order the modules are registered. A module
 * that fails is left out (the rest still show); nothing is searched for an empty query.
 */
export async function runSearches(
  modules: readonly Searchable[],
  query: string
): Promise<SearchGroup[]> {
  if (query.trim() === '') return []
  const groups = await Promise.all(
    modules.map(async (m): Promise<SearchGroup> => {
      try {
        return { id: m.id, label: m.label, hits: await m.search(query) }
      } catch (error) {
        console.error(`Searching ${m.label} failed:`, error)
        return { id: m.id, label: m.label, hits: [] }
      }
    })
  )
  return groups.filter((g) => g.hits.length > 0)
}
