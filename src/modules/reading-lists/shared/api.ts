import type { NoteContent } from '@shared/notes'
import type { ListChanges } from './front-matter'
import type {
  ReadingListIndexRow,
  ReadingListMeta,
  ReadingListRef,
  ReadingListWorkspace
} from './types'

export interface CreateListInput {
  workspace: ReadingListWorkspace
  title?: string
}

/** A list file as read from disk, split into its parts. */
export interface ReadingListFile {
  ref: ReadingListRef
  /** The whole file (front matter and body) and its hash; `baseHash` for the next save. */
  note: NoteContent
  meta: ReadingListMeta
  /** The list's Markdown body (its sections and entries), exactly as on disk. */
  body: string
  /** The file's modified time in milliseconds. */
  edited: number
}

/** The result of saving a list. Changing the title renames the file, and says so. */
export type ReadingListSaveResult =
  | {
      status: 'saved'
      hash: string
      /** The list's new id when its file was renamed. */ renamedTo?: string
    }
  | { status: 'conflict'; disk: NoteContent }

export type { ListChanges }

/** Pushed to the renderer when a list file changes on disk (from any tool, including this app). */
export interface ReadingListChangedEvent {
  ref: ReadingListRef
  /** Hash of the whole file now; null when the file was removed. */
  hash: string | null
}

/** One list that mentions a reading, for that reading's own page. */
export interface ReadingListMention {
  ref: ReadingListRef
  listTitle: string
  section: string
  annotation: string
}

/** The Reading lists slice of window.api. */
export interface ReadingListsApi {
  /** Create a new list file and resolve with it. Never replaces an existing file. */
  create(input: CreateListInput): Promise<ReadingListFile>
  read(ref: ReadingListRef): Promise<ReadingListFile>
  /** Every list in a workspace from the index, most recently edited first. */
  list(workspace: ReadingListWorkspace): Promise<ReadingListIndexRow[]>
  /**
   * Save changes to the front matter fields and/or the body. `baseHash` is the hash of the file the
   * caller last read or saved; if the file has since changed on disk nothing is written and a
   * conflict is returned. Changing the title renames the file.
   */
  save(ref: ReadingListRef, changes: ListChanges, baseHash: string): Promise<ReadingListSaveResult>
  /** Move the list's file to the Trash. The caller is responsible for asking the user first. */
  delete(ref: ReadingListRef): Promise<void>
  /** Every list (in every workspace) that names this reading, for its own page. */
  forReading(citekey: string): Promise<ReadingListMention[]>
  /** Subscribe to list files changing on disk. Returns an unsubscribe function. */
  onChanged(listener: (event: ReadingListChangedEvent) => void): () => void
}

export const READING_LISTS_IPC = {
  create: 'reading-lists:create',
  read: 'reading-lists:read',
  list: 'reading-lists:list',
  save: 'reading-lists:save',
  delete: 'reading-lists:delete',
  forReading: 'reading-lists:for-reading',
  changed: 'reading-lists:changed'
} as const
