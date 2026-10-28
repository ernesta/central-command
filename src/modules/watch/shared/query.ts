import type { WatchItem } from './types'

/** What the list pages can show: one state, or every item grouped by state. `seen` is what the page calls Read. */
export const LIST_STATES = ['saved', 'new', 'seen', 'all'] as const
export type ListState = (typeof LIST_STATES)[number]

export const LIST_STATE_LABELS: Record<ListState, string> = {
  saved: 'Saved',
  new: 'New',
  seen: 'Read',
  all: 'All'
}

export interface WatchQuery {
  search: string
  /** A source's id as text, or "all". */
  source: string
  state: ListState
}

export const DEFAULT_WATCH_QUERY: WatchQuery = { search: '', source: 'all', state: 'all' }

export const watchFiltersActive = (q: WatchQuery): boolean =>
  q.search.trim() !== '' || q.source !== 'all' || q.state !== 'all'

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
    if (query.state !== 'all' && i.state !== query.state) return false
    if (query.source !== 'all' && String(i.sourceId) !== query.source) return false
    const text = normal(`${i.title} ${i.sourceTitle}`)
    return words.every((w) => text.includes(w))
  })
}

export interface WatchGroup {
  key: 'saved' | 'new' | 'seen' | 'one'
  label: string | null
  rows: WatchItem[]
}

/**
 * The rows in groups. "All" is Saved, New, Read, each only when it has rows, with a header; a list of one state is one group with no
 * header. Within a group the order given is kept.
 */
export function groupItems(items: readonly WatchItem[], query: WatchQuery): WatchGroup[] {
  if (query.state !== 'all')
    return items.length ? [{ key: 'one', label: null, rows: [...items] }] : []
  return (
    [
      { key: 'saved', label: LIST_STATE_LABELS.saved, state: 'saved' },
      { key: 'new', label: LIST_STATE_LABELS.new, state: 'new' },
      { key: 'seen', label: LIST_STATE_LABELS.seen, state: 'seen' }
    ] as const
  )
    .map(({ key, label, state }) => ({
      key,
      label,
      rows: items.filter((i) => i.state === state)
    }))
    .filter((g) => g.rows.length > 0)
}

/** How many rows a group shows before "Show N more". */
export const GROUP_ROWS_SHOWN = 10

export interface ShownGroup extends WatchGroup {
  /** Rows left out until the group is opened up. */
  hidden: number
}

/** The groups cut to GROUP_ROWS_SHOWN rows each, except the ones whose key is in `opened`. Search and source filters apply before this. */
export function cutGroups(
  groups: readonly WatchGroup[],
  opened: ReadonlySet<WatchGroup['key']>
): ShownGroup[] {
  return groups.map((g) =>
    opened.has(g.key) || g.rows.length <= GROUP_ROWS_SHOWN
      ? { ...g, hidden: 0 }
      : { ...g, rows: g.rows.slice(0, GROUP_ROWS_SHOWN), hidden: g.rows.length - GROUP_ROWS_SHOWN }
  )
}
