import {
  EntrySession,
  type EntrySessionApi,
  type EntrySessionOptions,
  type EntrySnapshot
} from '@renderer/notes/entry-session'
import type { NoteChangedEvent, NoteFile, NoteSaveResult } from '../shared/api'
import { parseMeta, splitNote, type NoteChanges } from '../shared/front-matter'
import type { NoteMeta, NoteRef } from '../shared/types'

/** The slice of the Notes API a note session needs. */
export interface NoteSessionApi extends EntrySessionApi<NoteRef, NoteMeta> {
  read(ref: NoteRef): Promise<NoteFile>
  save(ref: NoteRef, changes: NoteChanges, baseHash: string): Promise<NoteSaveResult>
  onChanged(listener: (event: NoteChangedEvent) => void): () => void
}

export type NoteSnapshot = EntrySnapshot<NoteMeta>

export const EMPTY_NOTE_META: NoteMeta = {
  title: '',
  group: '',
  subgroup: '',
  pinned: false,
  created: ''
}

/**
 * One note being edited: its fields and its text together, saved as one file (see `EntrySession` for
 * the rules that protect the user's writing).
 */
export class NoteSession extends EntrySession<NoteRef, NoteMeta> {
  constructor(ref: NoteRef, api: NoteSessionApi, options: EntrySessionOptions = {}) {
    super(
      ref,
      api,
      {
        emptyMeta: EMPTY_NOTE_META,
        parseDisk: (note) => {
          const { head, body } = splitNote(note.content)
          return { meta: parseMeta(head).meta, body }
        },
        missingPattern: /Note not found/,
        noun: 'note'
      },
      options
    )
  }
}
