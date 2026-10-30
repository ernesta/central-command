import { snippet, type SearchHit } from '@shared/search'
import { dayItem } from '@shared/search-dates'
import {
  dateFilterMatches,
  passesFilters,
  searchNeedles,
  textMatches,
  type SearchRequest
} from '@shared/search-query'
import { fold } from '@shared/text'
import type { WatchItem, WatchWorkspace } from '../shared/types'
import { titleParts } from '../shared/rows'
import { watchListRoute } from './watch-paths'

const DEFAULT_LIMIT = 6

/** The items that match, saved first, then new, then read (the list's own order), with the part of the text that matched. */
export function watchHits(
  items: readonly WatchItem[],
  request: SearchRequest,
  limit = DEFAULT_LIMIT
): SearchHit[] {
  const terms = searchNeedles(request)
  const rank = { saved: 0, new: 1, read: 2 } as const
  return items
    .filter((item) =>
      textMatches(fold(`${item.title} ${item.summary} ${item.sourceTitle}`), request)
    )
    .filter((item) =>
      passesFilters(request.filters, (f) =>
        dateFilterMatches(f, request.today, item.date ? dayItem(item.date) : null)
      )
    )
    .sort((a, b) => rank[a.state] - rank[b.state])
    .slice(0, limit)
    .map((item) => {
      const inTitle = terms.every((t) => fold(item.title).includes(t))
      return {
        key: String(item.id),
        title: titleParts(item.title).name,
        detail: (!inTitle && snippet(item.summary, terms)) || item.sourceTitle,
        route: watchListRoute(item.section, item.workspace, item.id)
      }
    })
}

export function searchWatch(
  workspace: WatchWorkspace
): (request: SearchRequest, limit?: number) => Promise<SearchHit[]> {
  return async (request, limit) =>
    watchHits(await window.api.watch.items.list({ workspace, limit: 1000 }), request, limit)
}
