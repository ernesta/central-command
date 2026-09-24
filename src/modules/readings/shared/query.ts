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
