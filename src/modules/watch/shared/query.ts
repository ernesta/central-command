import type { WatchItem } from './types'

/** What the list pages can show: everything not dismissed (the start), or only one state. */
export const LIST_STATES = ['undismissed', 'new', 'saved', 'dismissed'] as const
export type ListState = (typeof LIST_STATES)[number]

export const LIST_STATE_LABELS: Record<ListState, string> = {
  undismissed: 'Not dismissed',
  new: 'New',
  saved: 'Saved',
  dismissed: 'Dismissed'
}

export interface WatchQuery {
  search: string
  /** A source's id as text, or "all". */
  source: string
  state: ListState
}

export const DEFAULT_WATCH_QUERY: WatchQuery = { search: '', source: 'all', state: 'undismissed' }

/** Turn whatever was remembered (possibly hand-edited) into a valid query. */
export function normaliseWatchQuery(raw: unknown): WatchQuery {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    search: typeof o.search === 'string' ? o.search : '',
    source: typeof o.source === 'string' && o.source !== '' ? o.source : 'all',
    state: (LIST_STATES as readonly unknown[]).includes(o.state)
      ? (o.state as ListState)
      : 'undismissed'
  }
}

export const watchFiltersActive = (q: WatchQuery): boolean =>
  q.search.trim() !== '' || q.source !== 'all' || q.state !== 'undismissed'

/** The sources of the items, for the source filter: each once, by name. */
export function sourceOptions(items: readonly WatchItem[]): { id: number; title: string }[] {
  const seen = new Map<number, string>()
  for (const i of items) seen.set(i.sourceId, i.sourceTitle)
  return [...seen]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

/** A remembered source that no longer has items must not hide everything. */
export function reconcileWatchQuery(query: WatchQuery, items: readonly WatchItem[]): WatchQuery {
  return query.source === 'all' || sourceOptions(items).some((s) => String(s.id) === query.source)
    ? query
    : { ...query, source: 'all' }
}

const normal = (s: string): string => s.toLowerCase()

/** The items a query keeps, in the order given (the repository's: new first, then newest). */
export function queryItems(items: readonly WatchItem[], query: WatchQuery): WatchItem[] {
  const words = normal(query.search).split(/\s+/).filter(Boolean)
  return items.filter((i) => {
    if (query.state === 'undismissed' ? i.state === 'dismissed' : i.state !== query.state)
      return false
    if (query.source !== 'all' && String(i.sourceId) !== query.source) return false
    const text = normal(`${i.title} ${i.sourceTitle}`)
    return words.every((w) => text.includes(w))
  })
}

export interface WatchGroup {
  key: 'new' | 'earlier' | 'all'
  label: string | null
  rows: WatchItem[]
}

/**
 * The rows in groups: "New" (not yet looked at) above "Earlier", each only when it has rows. Only the default view is
 * grouped: a list of one state needs no header.
 */
export function groupItems(items: readonly WatchItem[], query: WatchQuery): WatchGroup[] {
  if (query.state !== 'undismissed')
    return items.length ? [{ key: 'all', label: null, rows: [...items] }] : []
  const fresh = items.filter((i) => i.state === 'new')
  const rest = items.filter((i) => i.state !== 'new')
  return [
    { key: 'new' as const, label: 'New', rows: fresh },
    { key: 'earlier' as const, label: 'Earlier', rows: rest }
  ].filter((g) => g.rows.length > 0)
}
