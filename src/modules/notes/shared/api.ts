import type { NoteContent } from '@shared/notes'
import type { NoteChanges } from './front-matter'
import type { NoteIndexRow, NoteMeta, NoteRef, NoteWorkspace } from './types'

export interface CreateNoteInput {
  workspace: NoteWorkspace
  title?: string
  group?: string
  subgroup?: string
  /** The note body; a new note starts empty when omitted. */
  body?: string
}

/** A note file as read from disk, split into its parts. */
export interface NoteFile {
  ref: NoteRef
  /** The whole file (front matter and body) and its hash; `baseHash` for the next save. */
  note: NoteContent
  meta: NoteMeta
  /** The note text after the front matter, exactly as on disk. */
  body: string
  /** The file's modified time in milliseconds. */
  edited: number
  /** What is wrong with the front matter, if anything. */
  problems: string[]
}

/** The result of saving a note. Changing the title renames the file, and says so. */
export type NoteSaveResult =
  | {
      status: 'saved'
      hash: string
      /** The note's new id when its file was renamed. */ renamedTo?: string
    }
  /** The file changed since `baseHash`; nothing was written. */
  | { status: 'conflict'; disk: NoteContent }

export type { NoteChanges }

/** Pushed to the renderer when a note file changes on disk (from any tool, including this app). */
export interface NoteChangedEvent {
  ref: NoteRef
  /** Hash of the whole file now; null when the file was removed. */
  hash: string | null
}

/** The Notes slice of window.api. */
export interface NotesApi {
  /** Create a new note file and resolve with it. Never replaces an existing file. */
  create(input: CreateNoteInput): Promise<NoteFile>
  read(ref: NoteRef): Promise<NoteFile>
  /** Every note in a workspace from the index, most recently edited first. */
  list(workspace: NoteWorkspace): Promise<NoteIndexRow[]>
  /**
   * Save changes to the front matter fields and/or the body. `baseHash` is the hash of the file the
   * caller last read or saved; if the file has since changed on disk nothing is written and a
   * conflict is returned. Changing the title renames the file.
   */
  save(ref: NoteRef, changes: NoteChanges, baseHash: string): Promise<NoteSaveResult>
  /** Move the note's file to the Trash. The caller is responsible for asking the user first. */
  delete(ref: NoteRef): Promise<void>
  /** Subscribe to note files changing on disk. Returns an unsubscribe function. */
  onChanged(listener: (event: NoteChangedEvent) => void): () => void
}

export const NOTES_IPC = {
  create: 'notes:create',
  read: 'notes:read',
  list: 'notes:list',
  save: 'notes:save',
  delete: 'notes:delete',
  changed: 'notes:changed'
} as const
