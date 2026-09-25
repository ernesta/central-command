import {
  EntrySession,
  type EntryFile,
  type EntrySessionApi,
  type EntrySessionOptions,
  type EntrySnapshot,
  type DiskVersion as EntryDiskVersion
} from '@renderer/notes/entry-session'
import type { MeetingChangedEvent, MeetingFile, SyncPreviousResult } from '../shared/api'
import type { MeetingChanges } from '../shared/front-matter'
import { parseMeta, splitNote } from '../shared/front-matter'
import type { MeetingMeta, MeetingRef } from '../shared/types'

/** The slice of the Meetings API a meeting session needs. */
export interface MeetingSessionApi extends EntrySessionApi<MeetingRef, MeetingMeta> {
  read(ref: MeetingRef): Promise<MeetingFile>
  save(
    ref: MeetingRef,
    changes: MeetingChanges,
    baseHash: string
  ): ReturnType<EntrySessionApi<MeetingRef, MeetingMeta>['save']>
  syncPreviousTodos(ref: MeetingRef, baseHash: string): Promise<SyncPreviousResult>
  onChanged(listener: (event: MeetingChangedEvent) => void): () => void
}

export type DiskVersion = EntryDiskVersion<MeetingMeta>
export type MeetingSnapshot = EntrySnapshot<MeetingMeta>

const EMPTY_META: MeetingMeta = {
  series: '',
  date: '',
  start: null,
  end: null,
  mode: null,
  attendees: [],
  skills: [],
  discussed: []
}

/**
 * One meeting being edited: its fields and its note together, saved as one file (see `EntrySession`
 * for the rules that protect the user's writing). Opening a meeting also adds any missing carried-over
 * TODOs (adds only) before the note is shown.
 */
export class MeetingSession extends EntrySession<MeetingRef, MeetingMeta> {
  constructor(
    ref: MeetingRef,
    private readonly meetings: MeetingSessionApi,
    options: EntrySessionOptions = {}
  ) {
    super(
      ref,
      meetings,
      {
        emptyMeta: EMPTY_META,
        parseDisk: (note) => {
          const { head, body } = splitNote(note.content)
          return { meta: parseMeta(head).meta, body }
        },
        missingPattern: /Meeting not found/,
        noun: 'meeting'
      },
      options
    )
  }

  protected override async prepare(
    file: EntryFile<MeetingRef, MeetingMeta>
  ): Promise<EntryFile<MeetingRef, MeetingMeta>> {
    const sync = await this.meetings.syncPreviousTodos(this.ref, file.note.hash)
    return sync.status === 'saved' && sync.added > 0 ? this.meetings.read(this.ref) : file
  }
}
