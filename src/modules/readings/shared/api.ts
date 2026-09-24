import type { ReadingsQuery, TagCount } from './query'
import type { Reading, ReadingCounts, SyncStatus } from './types'

/** The Readings slice of window.api. */
export interface ReadingsApi {
  sync: {
    /** Run a sync now (or join the one in progress) and resolve with the result. */
    now(): Promise<SyncStatus>
    status(): Promise<SyncStatus>
    /** Subscribe to status changes pushed from the main process. Returns an unsubscribe function. */
    onStatus(listener: (status: SyncStatus) => void): () => void
  }
  counts(): Promise<ReadingCounts>
  /** Readings matching the query, filtered and ordered in the main process. */
  list(query: ReadingsQuery): Promise<Reading[]>
  /** All tags in use, with how many readings carry each. */
  tags(): Promise<TagCount[]>
  get(citekey: string): Promise<Reading | null>
}

export const READINGS_IPC = {
  syncNow: 'readings:sync-now',
  syncStatus: 'readings:sync-status',
  syncStatusChanged: 'readings:sync-status-changed',
  counts: 'readings:counts',
  list: 'readings:list',
  tags: 'readings:tags',
  get: 'readings:get'
} as const
