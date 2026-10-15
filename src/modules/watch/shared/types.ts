export const WATCH_KINDS = [
  'conference',
  'training',
  'summer-school',
  'journal',
  'listing',
  'other'
] as const
export type WatchKind = (typeof WATCH_KINDS)[number]

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
  Pick<WatchSource, 'title' | 'kind' | 'groupLabel' | 'intervalHours' | 'active'>
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
  state?: WatchState | 'open'
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
