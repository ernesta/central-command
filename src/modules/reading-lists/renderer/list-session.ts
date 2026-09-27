import {
  EntrySession,
  type EntrySessionApi,
  type EntrySessionOptions,
  type EntrySnapshot
} from '@renderer/notes/entry-session'
import type {
  ListChanges,
  ReadingListChangedEvent,
  ReadingListFile,
  ReadingListSaveResult
} from '../shared/api'
import { parseMeta, splitNote } from '../shared/front-matter'
import type { ReadingListMeta, ReadingListRef } from '../shared/types'

/** The slice of the Reading lists API a list session needs. */
export interface ListSessionApi extends EntrySessionApi<ReadingListRef, ReadingListMeta> {
  read(ref: ReadingListRef): Promise<ReadingListFile>
  save(ref: ReadingListRef, changes: ListChanges, baseHash: string): Promise<ReadingListSaveResult>
  onChanged(listener: (event: ReadingListChangedEvent) => void): () => void
}

export type ListSnapshot = EntrySnapshot<ReadingListMeta>

export const EMPTY_LIST_META: ReadingListMeta = { title: '' }

/** One reading list being edited: its title and its body (sections and entries) together, as one file. */
export class ListSession extends EntrySession<ReadingListRef, ReadingListMeta> {
  constructor(ref: ReadingListRef, api: ListSessionApi, options: EntrySessionOptions = {}) {
    super(
      ref,
      api,
      {
        emptyMeta: EMPTY_LIST_META,
        parseDisk: (note) => {
          const { head, body } = splitNote(note.content)
          return { meta: parseMeta(head).meta, body }
        },
        missingPattern: /Reading list not found/,
        noun: 'reading list'
      },
      options
    )
  }
}
