export const WATCH_KINDS = [
  'conference',
  'training',
  'summer-school',
  'journal',
  'listing',
  'other'
] as const
export type WatchKind = (typeof WATCH_KINDS)[number]

/** The two kinds the Watch page shows (a journals list may come later). A summer school is a training. */
export const SHOWN_KINDS = ['training', 'conference'] as const
export type ShownKind = (typeof SHOWN_KINDS)[number]

/** The section a source's items belong to, or null for a kind the page does not show yet (journals, listings). */
export function shownKind(kind: WatchKind): ShownKind | null {
  if (kind === 'training' || kind === 'summer-school') return 'training'
  if (kind === 'conference') return 'conference'
  return null
}

/** The stored kinds that make up a shown one. */
export const kindsOf = (kind: ShownKind): WatchKind[] =>
  kind === 'training' ? ['training', 'summer-school'] : ['conference']

/** How a source is read: a feed (RSS or Atom), a web page (new links, or a changed text), or Crossref's list of a journal's newest articles. */
export const WATCH_METHODS = ['feed', 'page', 'crossref'] as const
export type WatchMethod = (typeof WATCH_METHODS)[number]

export const WATCH_STATES = ['new', 'seen', 'saved', 'dismissed'] as const
export type WatchState = (typeof WATCH_STATES)[number]

export interface WatchSource {
  id: number
  title: string
  url: string
  kind: WatchKind
  method: WatchMethod
  issn: string | null
  groupLabel: string
  taskUid: string | null
  intervalHours: number
  active: boolean
  lastCheckedAt: string | null
  lastOkAt: string | null
  lastError: string | null
  failures: number
  /** The page's text changed without a new link to show for it (page method). */
  changedAt: string | null
  createdAt: string
  /** Items not yet looked at. */
  newCount: number
}

export interface NewWatchSource {
  title: string
  url: string
  kind: WatchKind
  method: WatchMethod
  issn?: string | null
  groupLabel?: string
  taskUid?: string | null
  intervalHours?: number
}

export type WatchSourceChanges = Partial<
  Pick<WatchSource, 'title' | 'url' | 'kind' | 'groupLabel' | 'intervalHours' | 'active'>
>

export type DateKind = 'deadline' | 'date'

export interface WatchItem {
  id: number
  sourceId: number
  sourceTitle: string
  kind: WatchKind
  title: string
  url: string
  summary: string
  publishedAt: string | null
  /** YYYY-MM-DD found in the text: a deadline, or the day of the event. */
  date: string | null
  dateKind: DateKind | null
  score: number
  matched: string[]
  state: WatchState
  firstSeenAt: string
}

export interface WatchItemsQuery {
  /** `open` is new or saved; `undismissed` is everything but dismissed. */
  state?: WatchState | 'open' | 'undismissed'
  sourceId?: number
  kind?: WatchKind
  /** Only items that mention at least one of the user's keywords. */
  relevantOnly?: boolean
  limit?: number
}

export interface WatchCounts {
  /** Items not yet looked at. */
  new: number
  /** Of those, the ones that mention a keyword. */
  newRelevant: number
  sources: number
  /** Sources whose last attempt failed. */
  failing: number
  /** Page sources whose text changed with nothing new to show. */
  changed: number
}

/** How a pasted address is probably read: a feed when it looks like one, a page otherwise. */
export function guessMethod(url: string): WatchMethod {
  return /\.(xml|rss|atom)(\?|$)|\/(rss|feed|atom)(\/|\?|$)|[?&]format=(rss|atom)/i.test(url)
    ? 'feed'
    : 'page'
}

/** What a source gave, before anything is stored. */
export interface ParsedItem {
  key: string
  title: string
  url: string
  summary: string
  publishedAt: string | null
}

export interface CheckOutcome {
  sourceId: number
  status: 'ok' | 'unchanged' | 'error'
  /** Items stored for the first time. */
  added: number
  /** The first good check only sets what is already there as the baseline; nothing is "new" then, except recent feed items. */
  baseline: boolean
  error?: string
}

export interface WatchSuggestion {
  title: string
  url: string
  kind: WatchKind
  method: WatchMethod
  issn?: string
  groupLabel: string
}
