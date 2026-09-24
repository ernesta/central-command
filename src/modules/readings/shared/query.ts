import type { ReadingStatus } from './types'

export type StatusFilter = 'all' | ReadingStatus
export type SortKey = 'citation' | 'title' | 'year' | 'status' | 'added' | 'updated'
export type SortDirection = 'asc' | 'desc'

export interface ReadingSort {
  key: SortKey
  direction: SortDirection
}

/** Everything the Readings list can be filtered and ordered by. */
export interface ReadingsQuery {
  /** Whitespace-separated terms; every term must match somewhere (accent- and case-insensitive). */
  search: string
  status: StatusFilter
  /** A reading must have every listed tag. */
  tags: string[]
  sort: ReadingSort
  /** Only readings no longer in the Zotero export. */
  missingOnly: boolean
}

export interface TagCount {
  tag: string
  count: number
}

export const DEFAULT_READINGS_QUERY: ReadingsQuery = {
  search: '',
  status: 'all',
  tags: [],
  sort: { key: 'year', direction: 'desc' },
  missingOnly: false
}

export type ReadingsView = 'table' | 'board'

/** The Readings list state that is remembered between visits and launches. */
export interface ReadingsViewPrefs extends ReadingsQuery {
  view: ReadingsView
}

export const DEFAULT_VIEW_PREFS: ReadingsViewPrefs = { ...DEFAULT_READINGS_QUERY, view: 'table' }

const STATUSES: readonly StatusFilter[] = ['all', 'read', 'to_read', 'unset']
const SORT_KEYS: readonly SortKey[] = ['citation', 'title', 'year', 'status', 'added', 'updated']

/**
 * Coerce untrusted input (IPC payloads, a hand-edited settings file) into a valid query,
 * falling back to defaults field by field.
 */
export function normaliseQuery(raw: unknown): ReadingsQuery {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const sort = o.sort && typeof o.sort === 'object' ? (o.sort as Record<string, unknown>) : {}
  const key = SORT_KEYS.find((k) => k === sort.key)
  const direction =
    sort.direction === 'asc' || sort.direction === 'desc' ? sort.direction : undefined
  return {
    search: typeof o.search === 'string' ? o.search : DEFAULT_READINGS_QUERY.search,
    status: STATUSES.find((s) => s === o.status) ?? DEFAULT_READINGS_QUERY.status,
    tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === 'string') : [],
    sort: key && direction ? { key, direction } : { ...DEFAULT_READINGS_QUERY.sort },
    missingOnly: o.missingOnly === true
  }
}

export function normaliseViewPrefs(raw: unknown): ReadingsViewPrefs {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return { ...normaliseQuery(raw), view: o.view === 'board' ? 'board' : 'table' }
}
