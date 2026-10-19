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
import { isUntouchedMeeting } from '../shared/untouched'

/** The slice of the Meetings API a meeting session needs. */
export interface MeetingSessionApi extends EntrySessionApi<MeetingRef, MeetingMeta> {
  read(ref: MeetingRef): Promise<MeetingFile>
  save(
    ref: MeetingRef,
    changes: MeetingChanges,
    baseHash: string
  ): ReturnType<EntrySessionApi<MeetingRef, MeetingMeta>['save']>
  syncPreviousTodos(ref: MeetingRef, baseHash: string): Promise<SyncPreviousResult>
  discardIfUntouched(ref: MeetingRef): Promise<boolean>
  onChanged(listener: (event: MeetingChangedEvent) => void): () => void
}

export type DiskVersion = EntryDiskVersion<MeetingMeta>
export type MeetingSnapshot = EntrySnapshot<MeetingMeta>

const EMPTY_META: MeetingMeta = {
  task: '',
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
  private removed = false

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

  /** True once leaving the page removed the meeting because nothing was written in it. */
  wasDiscarded = (): boolean => this.removed

  /**
   * Leaving the page (back, another workspace, any link): saves anything pending, then removes the meeting if it is still exactly what
   * New meeting made, with its own task. The main process checks the file itself, so a meeting that was changed is never removed.
   */
  override async dispose(): Promise<void> {
    if (this.isDisposed()) return
    this.removed = false
    await super.dispose()
    // React Strict Mode (dev) cleans up and starts again at once: a session that was revived is still being used.
    if (!this.isDisposed()) return
    await this.discardIfUntouched()
  }

  /** Saves anything pending and stops, without removing the meeting (it is being moved, not left). */
  async disposeKeeping(): Promise<void> {
    await super.dispose()
  }

  /** The window is closing or the app quitting: saved, and an untouched meeting removed, as on leaving the page. */
  async settle(): Promise<void> {
    await this.flush()
    await this.discardIfUntouched()
  }

  private async discardIfUntouched(): Promise<void> {
    const { status, conflict, meta, body } = this.getSnapshot()
    if (status !== 'ready' || conflict || !isUntouchedMeeting(meta, body)) return
    try {
      this.removed = await this.meetings.discardIfUntouched(this.getRef())
    } catch (error) {
      console.error('Could not remove the untouched meeting:', error)
    }
  }
}
