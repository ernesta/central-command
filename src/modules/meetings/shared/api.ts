import type { NoteContent, NoteWriteResult } from '@shared/notes'
import type { MeetingChanges } from './front-matter'
import type { MeetingMeta, MeetingMode, MeetingRef, MeetingWorkspace, Person } from './types'

export interface CreateMeetingInput {
  workspace: MeetingWorkspace
  /** One of SERIES. */
  series: string
  /** YYYY-MM-DD. */
  date: string
  start?: string | null
  end?: string | null
  mode?: MeetingMode | null
  attendees?: string[]
  /** The note body; a new meeting gets the standard template when omitted. */
  body?: string
}

/** A meeting file as read from disk, split into its parts. */
export interface MeetingFile {
  ref: MeetingRef
  /** The whole file (front matter and body) and its hash; `baseHash` for the next save. */
  note: NoteContent
  meta: MeetingMeta
  /** The note text after the front matter, exactly as on disk. */
  body: string
  /** What is wrong with the front matter, if anything. */
  problems: string[]
}

/** The result of filling a meeting's Previous TODOs from the meeting before it. */
export type SyncPreviousResult =
  | {
      status: 'saved'
      hash: string
      /** How many items were added (0 when nothing was missing). */ added: number
    }
  /** The file changed since `baseHash`; nothing was written. */
  | { status: 'conflict'; disk: NoteContent }

/** Pushed to the renderer when a meeting file changes on disk (from any tool, including this app). */
export interface MeetingChangedEvent {
  ref: MeetingRef
  /** Hash of the whole file now; null when the file was removed. */
  hash: string | null
}

/** The Meetings slice of window.api. */
export interface MeetingsApi {
  /** Create a new meeting file and resolve with it. Never replaces an existing file. */
  create(input: CreateMeetingInput): Promise<MeetingFile>
  read(ref: MeetingRef): Promise<MeetingFile>
  /**
   * Save changes to the front matter fields and/or the body. `baseHash` is the hash of the file the
   * caller last read or saved; if the file has since changed on disk nothing is written and a
   * conflict is returned.
   */
  save(ref: MeetingRef, changes: MeetingChanges, baseHash: string): Promise<NoteWriteResult>
  /** Move the meeting's file to the Trash. The caller is responsible for asking the user first. */
  delete(ref: MeetingRef): Promise<void>
  /**
   * Add to this meeting's Previous TODOs whatever is open in the previous meeting of the series and
   * not listed yet. Only adds; never removes or edits an item or touches ticked state.
   */
  syncPreviousTodos(ref: MeetingRef, baseHash: string): Promise<SyncPreviousResult>
  people: {
    list(): Promise<Person[]>
    /** Add a person (initials are worked out from the name and made unique). Resolves with the new list. */
    add(name: string): Promise<Person[]>
  }
  /** Subscribe to meeting files changing on disk. Returns an unsubscribe function. */
  onChanged(listener: (event: MeetingChangedEvent) => void): () => void
}

export const MEETINGS_IPC = {
  create: 'meetings:create',
  read: 'meetings:read',
  save: 'meetings:save',
  delete: 'meetings:delete',
  syncPrevious: 'meetings:sync-previous',
  peopleList: 'meetings:people-list',
  peopleAdd: 'meetings:people-add',
  changed: 'meetings:changed'
} as const
