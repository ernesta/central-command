import type { NoteContent } from '@shared/notes'
import type { MeetingChanges } from './front-matter'
import type { NewPerson, PersonPatch } from './people'
import type {
  MeetingIndexRow,
  MeetingMeta,
  MeetingMode,
  MeetingRef,
  MeetingWorkspace,
  Person
} from './types'

export interface CreateMeetingInput {
  workspace: MeetingWorkspace
  /** One of SERIES. */
  series: string
  /** YYYY-MM-DD; leave out (or '') for a meeting that is planned but not yet scheduled. */
  date?: string
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

/** The result of saving a meeting. Changing the date or series renames the file, and says so. */
export type MeetingSaveResult =
  | {
      status: 'saved'
      hash: string
      /** The meeting's new id when its file was renamed. */ renamedTo?: string
    }
  /** The file changed since `baseHash`; nothing was written. */
  | { status: 'conflict'; disk: NoteContent }

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

export type MeetingsExportResult = { status: 'saved'; path: string } | { status: 'cancelled' }

/** The Meetings slice of window.api. */
export interface MeetingsApi {
  /** Create a new meeting file and resolve with it. Never replaces an existing file. */
  create(input: CreateMeetingInput): Promise<MeetingFile>
  read(ref: MeetingRef): Promise<MeetingFile>
  /** Every meeting in a workspace from the index, newest first. */
  list(workspace: MeetingWorkspace): Promise<MeetingIndexRow[]>
  /**
   * Save changes to the front matter fields and/or the body. `baseHash` is the hash of the file the
   * caller last read or saved; if the file has since changed on disk nothing is written and a
   * conflict is returned.
   */
  save(ref: MeetingRef, changes: MeetingChanges, baseHash: string): Promise<MeetingSaveResult>
  /** Move the meeting's file to the Trash. The caller is responsible for asking the user first. */
  delete(ref: MeetingRef): Promise<void>
  /**
   * Add to this meeting's Previous TODOs whatever is open in the previous meeting of the series and
   * not listed yet. Only adds; never removes or edits an item or touches ticked state.
   */
  syncPreviousTodos(ref: MeetingRef, baseHash: string): Promise<SyncPreviousResult>
  /** Ask where to save, then write the Supervision log of an academic year (its start year) as a PDF. */
  exportPdf(year: number): Promise<MeetingsExportResult>
  people: {
    list(): Promise<Person[]>
    /** Add a person (initials are worked out from the name and made unique unless given). Resolves with the new list. */
    add(input: NewPerson): Promise<Person[]>
    /** Change a person's name, initials (which must stay unique) or "me". Resolves with the new list. */
    update(name: string, patch: PersonPatch): Promise<Person[]>
    /** Remove a person from the list. Meeting files that mention them are not touched. */
    remove(name: string): Promise<Person[]>
  }
  /** Subscribe to meeting files changing on disk. Returns an unsubscribe function. */
  onChanged(listener: (event: MeetingChangedEvent) => void): () => void
}

export const MEETINGS_IPC = {
  create: 'meetings:create',
  read: 'meetings:read',
  list: 'meetings:list',
  save: 'meetings:save',
  delete: 'meetings:delete',
  syncPrevious: 'meetings:sync-previous',
  exportPdf: 'meetings:export-pdf',
  peopleList: 'meetings:people-list',
  peopleAdd: 'meetings:people-add',
  peopleUpdate: 'meetings:people-update',
  peopleRemove: 'meetings:people-remove',
  changed: 'meetings:changed'
} as const
