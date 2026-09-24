import type { NoteChangedEvent, NoteContent, NoteWriteResult } from '@shared/notes'
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
  notes: {
    read(citekey: string): Promise<NoteContent>
    /**
     * Save a note. `baseHash` is the hash of the version the editor started from; if the file
     * has since changed on disk nothing is written and a conflict is returned.
     */
    write(citekey: string, content: string, baseHash: string): Promise<NoteWriteResult>
    /** Subscribe to notes changing on disk (including this app's own saves). Returns an unsubscribe function. */
    onChanged(listener: (event: NoteChangedEvent) => void): () => void
  }
}

export const READINGS_IPC = {
  syncNow: 'readings:sync-now',
  syncStatus: 'readings:sync-status',
  syncStatusChanged: 'readings:sync-status-changed',
  counts: 'readings:counts',
  list: 'readings:list',
  tags: 'readings:tags',
  get: 'readings:get',
  notesRead: 'readings:notes-read',
  notesWrite: 'readings:notes-write',
  notesChanged: 'readings:notes-changed'
} as const
