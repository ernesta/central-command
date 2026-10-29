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

/**
 * Items the page is holding in place: ones the user opened this visit. They are Read in the database, but until the page is left they
 * keep the place and the state they had (a New row stays in New, in its order) and show dimmed. A view-state, never stored.
 */
export type Held = ReadonlySet<number>

/** The state a row is listed under: a held row still counts as New. */
export const listedState = (item: WatchItem, held?: Held): WatchItem['state'] =>
  held?.has(item.id) && item.state === 'seen' ? 'new' : item.state

/** A row the page holds: Read in the database, listed as New, drawn dimmed. */
export const isHeld = (item: WatchItem, held?: Held): boolean =>
  listedState(item, held) !== item.state

const day = (s: string): string => s.slice(0, 10)
const later = (a: string, b: string): number => (a === b ? 0 : a < b ? 1 : -1)

/**
 * The order the repository lists in (New first; Read, most recently read first with those that have no time last; then the day
 * found, the day published, newest id), with a held row sorted as the New row it was.
 */
export function sortItems(items: readonly WatchItem[], held?: Held): WatchItem[] {
  const isNew = (i: WatchItem): number => (listedState(i, held) === 'new' ? 1 : 0)
  const readKey = (i: WatchItem): string =>
    listedState(i, held) === 'seen' ? (i.readAt ?? '') : ''
  return [...items].sort(
    (a, b) =>
      isNew(b) - isNew(a) ||
      later(readKey(a), readKey(b)) ||
      later(day(a.firstSeenAt), day(b.firstSeenAt)) ||
      later(a.publishedAt ?? a.firstSeenAt, b.publishedAt ?? b.firstSeenAt) ||
      b.id - a.id
  )
}

const normal = (s: string): string => s.toLowerCase()

/** The items a query keeps, in the order given (the repository's: new first, then newest). */
export function queryItems(
  items: readonly WatchItem[],
  query: WatchQuery,
  held?: Held
): WatchItem[] {
  const words = normal(query.search).split(/\s+/).filter(Boolean)
  return items.filter((i) => {
    if (query.state !== 'all' && listedState(i, held) !== query.state) return false
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
export function groupItems(
  items: readonly WatchItem[],
  query: WatchQuery,
  held?: Held
): WatchGroup[] {
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
      rows: items.filter((i) => listedState(i, held) === state)
    }))
    .filter((g) => g.rows.length > 0)
}

/** The groups to open up: the ones opened by hand, and the one whose cut part holds the wanted item (a search hit's). */
export function openedWith(
  groups: readonly WatchGroup[],
  opened: ReadonlySet<WatchGroup['key']>,
  wantedId: number | null
): ReadonlySet<WatchGroup['key']> {
  const wanted = groups.find((g) =>
    g.rows.slice(GROUP_ROWS_SHOWN).some((r) => r.id === wantedId)
  )?.key
  return wanted ? new Set([...opened, wanted]) : opened
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
