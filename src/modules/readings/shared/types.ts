/** A person (`family`, optional `given`) or an institution (`literal`). */
export type Author = { family: string; given?: string } | { literal: string }

export type ReadingStatus = 'read' | 'to_read' | 'unset'

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
}
