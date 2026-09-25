import type { NoteContent } from '@shared/notes'
import type { NoteChanges } from './front-matter'
import type { NoteMeta, NoteRef, NoteWorkspace } from './types'

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
