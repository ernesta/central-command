/** A person (`family`, optional `given`) or an institution (`literal`). */
export type Author = { family: string; given?: string } | { literal: string }

export type ReadingStatus = 'read' | 'to_read' | 'unset'

/**
 * Bibliographic details beyond the basics, kept so a reference can be formatted (e.g. APA).
 * Values are stored as Zotero has them; formatting happens later.
 */
export interface ReferenceDetails {
  /** The title in sentence case (from Better BibTeX's case protection), for styles that want it. */
  titleSentence: string
  /** Journal, book or proceedings title as stored. */
  container?: string
  /** The container title in sentence case (book titles). */
  containerSentence?: string
  volume?: string
  issue?: string
  pages?: string
  articleNumber?: string
  publisher?: string
  place?: string
  edition?: string
  doi?: string
  url?: string
  editors?: Author[]
  /** Report number, or thesis/report type such as "PhD thesis". */
  reportNumber?: string
  genre?: string
  /** Institution, university or organisation. */
  institution?: string
  version?: string
  /** The date exactly as exported (2023, 2023-05, 2023-05-12). */
  date?: string
  /** True for preprints (Better BibTeX pubstate "prepublished"). */
  preprint?: boolean
}

/** A reading as the UI sees it. */
export interface Reading {
  id: number
  citekey: string
  shortCitation: string
  fullTitle: string
  authors: Author[]
  year: number | null
  status: ReadingStatus
  tags: string[]
  abstract: string | null
  entryType: string
  /** Null until the first sync after this field was introduced. */
  reference: ReferenceDetails | null
  missingFromSource: boolean
  hasNotes: boolean
  notesExcerpt: string
  addedAt: string
  updatedAt: string
}

/** The fields a sync derives from one .bib entry (everything Zotero owns). */
export interface SyncedFields {
  citekey: string
  shortCitation: string
  fullTitle: string
  authors: Author[]
  year: number | null
  status: ReadingStatus
  tags: string[]
  abstract: string | null
  entryType: string
  reference: ReferenceDetails
}

/** What one sync changed. */
export interface SyncCounts {
  entriesSeen: number
  inserted: number
  updated: number
  flaggedMissing: number
}

/** A recorded sync attempt (a row of sync_runs). */
export interface SyncRun extends SyncCounts {
  startedAt: string
  finishedAt: string
  status: 'ok' | 'error'
  errorMessage: string | null
}

/**
 * - not_configured: the export file does not exist (yet); shown as a setup state, not an error
 * - idle: last sync succeeded
 * - syncing: a sync is running
 * - error: the last sync failed; existing data is untouched
 */
export type SyncState = 'not_configured' | 'idle' | 'syncing' | 'error'

export interface SyncStatus {
  state: SyncState
  /** Most recent recorded attempt, ok or error. */
  lastRun: SyncRun | null
  /** When the last successful sync finished; null before any success. */
  lastSuccessAt: string | null
  /** Human-readable reason when state is error. */
  message: string | null
}

export interface ReadingCounts {
  total: number
  read: number
  toRead: number
  unset: number
  missingFromSource: number
}
