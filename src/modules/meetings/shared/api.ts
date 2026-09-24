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
  people: {
    list(): Promise<Person[]>
  }
  /** Subscribe to meeting files changing on disk. Returns an unsubscribe function. */
  onChanged(listener: (event: MeetingChangedEvent) => void): () => void
}

export const MEETINGS_IPC = {
  create: 'meetings:create',
  read: 'meetings:read',
  save: 'meetings:save',
  delete: 'meetings:delete',
  peopleList: 'meetings:people-list',
  changed: 'meetings:changed'
} as const
