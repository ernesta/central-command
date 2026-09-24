import type { NoteContent } from '@shared/notes'
import type { SaveState } from '@renderer/notes/notes-session'
import type {
  MeetingChangedEvent,
  MeetingFile,
  MeetingSaveResult,
  SyncPreviousResult
} from '../shared/api'
import type { MeetingChanges, MetaPatch } from '../shared/front-matter'
import { parseMeta, splitNote } from '../shared/front-matter'
import type { MeetingMeta, MeetingRef } from '../shared/types'

/** The slice of the Meetings API a meeting session needs. */
export interface MeetingSessionApi {
  read(ref: MeetingRef): Promise<MeetingFile>
  save(ref: MeetingRef, changes: MeetingChanges, baseHash: string): Promise<MeetingSaveResult>
  syncPreviousTodos(ref: MeetingRef, baseHash: string): Promise<SyncPreviousResult>
  onChanged(listener: (event: MeetingChangedEvent) => void): () => void
}

/** What the other version of the file looks like, for the conflict notice. */
export interface DiskVersion {
  note: NoteContent
  meta: MeetingMeta
  body: string
}

export interface MeetingSnapshot {
  status: 'loading' | 'ready' | 'missing'
  /** The meeting's fields as shown: saved values with any unsaved edits on top. */
  meta: MeetingMeta
  /** What is wrong with the front matter, if anything. */
  problems: string[]
  /** The note text as it stands now (drives the topics panel). */
  body: string
  /** The Markdown the editor should be (re)created with. Only changes when `editorKey` does. */
  initialBody: string
  /** Changes whenever the editor must be recreated (first load, body changed on disk, topic added). */
  editorKey: number
  save: SaveState
  error: string | null
  /** Set when the file changed on disk while we have unsaved edits; saving is paused until resolved. */
  conflict: DiskVersion | null
  /** True after the meeting was refreshed from disk because another tool changed it. */
  reloadedFromDisk: boolean
}

const EMPTY_META: MeetingMeta = {
  series: '',
  date: '',
  start: null,
  end: null,
  mode: null,
  attendees: [],
  discussed: []
}

interface Options {
  /** How long after the last edit to save. */
  debounceMs?: number
  /** Called when saving renamed the meeting's file (its date or series changed), with the new id. */
  onRenamed?: (id: string) => void
}

function diskVersion(note: NoteContent): DiskVersion {
  const { head, body } = splitNote(note.content)
  return { note, meta: parseMeta(head).meta, body }
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/**
 * One meeting being edited: its fields and its note together, saved as one file. Framework-free so
 * it can be tested with a fake disk.
 *
 * Rules that protect the user's writing (the same ones as `NotesSession`):
 * - Every save says which version of the file it builds on; if the file moved on, nothing is written
 *   and the user chooses to keep their version or take the file's.
 * - A change on disk while nothing is unsaved is simply loaded in (the editor is only recreated when
 *   the note text itself changed, so editing a field elsewhere never disturbs the cursor).
 * - Opening a meeting adds any missing carried-over TODOs (adds only) before the note is shown.
 */
export class MeetingSession {
  private snapshot: MeetingSnapshot = {
    status: 'loading',
    meta: EMPTY_META,
    problems: [],
    body: '',
    initialBody: '',
    editorKey: 0,
    save: 'clean',
    error: null,
    conflict: null,
    reloadedFromDisk: false
  }
  private readonly listeners = new Set<() => void>()
  private readonly debounceMs: number
  private onRenamed: ((id: string) => void) | undefined
  private timer: ReturnType<typeof setTimeout> | null = null
  private inflight: Promise<void> | null = null
  private saveAgain = false
  private disposed = false
  private unsubscribe: (() => void) | null = null

  /** Hash of the file version our next save builds on. */
  private baseHash = ''
  /** What is on disk as far as we know, and what is waiting to be saved. */
  private savedMeta: MeetingMeta = EMPTY_META
  private savedBody = ''
  private latestBody = ''
  private pendingMeta: MetaPatch = {}

  constructor(
    private ref: MeetingRef,
    private readonly api: MeetingSessionApi,
    options: Options = {}
  ) {
    this.debounceMs = options.debounceMs ?? 500
    this.onRenamed = options.onRenamed
  }

  getSnapshot = (): MeetingSnapshot => this.snapshot

  /** Set who to tell when saving renames the meeting's file. */
  setOnRenamed = (listener: ((id: string) => void) | undefined): void => {
    this.onRenamed = listener
  }

  /** Which meeting this is now (its id changes when a date or series edit renames the file). */
  getRef = (): MeetingRef => this.ref

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Begin listening for outside changes and load the meeting. Safe to call again after `dispose()`
   * (React StrictMode mounts, unmounts and remounts a component in development).
   */
  async start(): Promise<void> {
    this.disposed = false
    this.unsubscribe?.()
    this.unsubscribe = this.api.onChanged((event) => void this.onExternalChange(event))

    let file: MeetingFile
    try {
      file = await this.api.read(this.ref)
    } catch {
      if (!this.disposed) this.update({ status: 'missing' })
      return
    }
    if (this.disposed) return
    try {
      const sync = await this.api.syncPreviousTodos(this.ref, file.note.hash)
      if (sync.status === 'saved' && sync.added > 0 && !this.disposed) {
        file = await this.api.read(this.ref)
      }
    } catch {
      // Carry-over is a convenience; the meeting opens without it.
    }
    if (this.disposed) return
    this.adopt(file)
    this.update({
      status: 'ready',
      editorKey: this.snapshot.editorKey + 1,
      save: 'clean',
      error: null,
      conflict: null
    })
  }

  /** Called on every change from the editor. */
  editBody(markdown: string): void {
    if (this.disposed || this.snapshot.status !== 'ready') return
    this.latestBody = markdown
    this.markDirty({ body: markdown, reloadedFromDisk: false })
  }

  /** Change one or more fields. Only these keys are written; everything else in the file is left alone. */
  setMeta(patch: MetaPatch): void {
    if (this.disposed || this.snapshot.status !== 'ready') return
    this.pendingMeta = { ...this.pendingMeta, ...patch }
    this.markDirty({ meta: { ...this.snapshot.meta, ...patch }, reloadedFromDisk: false })
  }

  /** Replace the whole note text (for example after adding a topic) and recreate the editor with it. */
  replaceBody(markdown: string): void {
    if (this.disposed || this.snapshot.status !== 'ready') return
    this.latestBody = markdown
    this.update({ initialBody: markdown, editorKey: this.snapshot.editorKey + 1 })
    this.markDirty({ body: markdown, reloadedFromDisk: false })
    void this.flush()
  }

  /** Save now (blur, leaving the page). Resolves when nothing more is pending. */
  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.snapshot.conflict || this.snapshot.status !== 'ready') return
    if (this.inflight) {
      this.saveAgain = true
      return this.inflight
    }
    if (!this.hasPending()) return
    this.inflight = this.saveOnce().finally(() => {
      this.inflight = null
    })
    await this.inflight
    if (this.saveAgain) {
      this.saveAgain = false
      await this.flush()
    }
  }

  /** Resolve a conflict by keeping our version: build on the file as it is now and save. */
  async keepMine(): Promise<void> {
    const conflict = this.snapshot.conflict
    if (!conflict) return
    this.baseHash = conflict.note.hash
    this.update({ conflict: null, save: 'dirty' })
    await this.flush()
  }

  /** Resolve a conflict by taking the file's version: drop our unsaved edits. */
  async useDisk(): Promise<void> {
    const conflict = this.snapshot.conflict
    if (!conflict) return
    this.adopt({
      ref: this.ref,
      note: conflict.note,
      meta: conflict.meta,
      body: conflict.body,
      problems: []
    })
    this.update({
      editorKey: this.snapshot.editorKey + 1,
      save: 'clean',
      error: null,
      conflict: null,
      reloadedFromDisk: false
    })
  }

  /** Stop listening and save anything pending. Safe to call more than once; `start()` can revive it. */
  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.unsubscribe?.()
    this.unsubscribe = null
    await this.flush()
  }

  private hasPending(): boolean {
    return Object.keys(this.pendingMeta).length > 0 || this.latestBody !== this.savedBody
  }

  private markDirty(patch: Partial<MeetingSnapshot>): void {
    const dirty = this.hasPending()
    this.update({
      ...patch,
      save: this.snapshot.save === 'saving' && dirty ? 'saving' : dirty ? 'dirty' : 'clean'
    })
    if (this.timer) clearTimeout(this.timer)
    this.timer = dirty ? setTimeout(() => void this.flush(), this.debounceMs) : null
  }

  private async saveOnce(): Promise<void> {
    const sentMeta = this.pendingMeta
    const sentBody = this.latestBody
    const changes: MeetingChanges = {}
    if (Object.keys(sentMeta).length > 0) changes.meta = sentMeta
    if (sentBody !== this.savedBody) changes.body = sentBody
    this.update({ save: 'saving', error: null })

    let result: MeetingSaveResult
    try {
      result = await this.api.save(this.ref, changes, this.baseHash)
    } catch (error) {
      this.update({ save: 'error', error: error instanceof Error ? error.message : String(error) })
      return
    }
    if (result.status === 'conflict') {
      this.update({ conflict: diskVersion(result.disk), save: 'dirty' })
      return
    }
    this.baseHash = result.hash
    if (result.renamedTo) {
      // The file now has a name that matches its date and series; keep talking about the same meeting.
      this.ref = { ...this.ref, id: result.renamedTo }
      this.onRenamed?.(result.renamedTo)
    }
    this.savedBody = sentBody
    this.savedMeta = { ...this.savedMeta, ...sentMeta } as MeetingMeta
    // Keep any field that was edited again while the save was running.
    const remaining: MetaPatch = {}
    for (const [key, value] of Object.entries(this.pendingMeta)) {
      if (!same(value, (sentMeta as Record<string, unknown>)[key])) {
        ;(remaining as Record<string, unknown>)[key] = value
      }
    }
    this.pendingMeta = remaining
    const dirty = this.hasPending()
    this.update({ save: dirty ? 'dirty' : 'clean' })
    if (dirty) this.saveAgain = true
  }

  private async onExternalChange(event: MeetingChangedEvent): Promise<void> {
    if (this.disposed || this.snapshot.status !== 'ready') return
    if (event.ref.id !== this.ref.id || event.ref.workspace !== this.ref.workspace) return
    if (event.hash === this.baseHash || this.inflight) return

    if (event.hash === null) {
      // Deleted (here or elsewhere). Keep what is on screen; the next save reports the missing file.
      return
    }
    let file: MeetingFile
    try {
      file = await this.api.read(this.ref)
    } catch {
      return
    }
    if (this.disposed || file.note.hash === this.baseHash || this.inflight) return

    if (!this.hasPending()) {
      const bodyChanged = file.body !== this.latestBody
      this.adopt(file)
      this.update({
        editorKey: bodyChanged ? this.snapshot.editorKey + 1 : this.snapshot.editorKey,
        initialBody: bodyChanged ? file.body : this.snapshot.initialBody,
        save: 'clean',
        conflict: null,
        reloadedFromDisk: true
      })
    } else {
      this.update({ conflict: diskVersion(file.note) })
    }
  }

  /** Treat `file` as the current state of the file on disk. */
  private adopt(file: MeetingFile): void {
    this.baseHash = file.note.hash
    this.savedMeta = file.meta
    this.savedBody = file.body
    this.latestBody = file.body
    this.pendingMeta = {}
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.update({
      meta: file.meta,
      problems: file.problems,
      body: file.body,
      initialBody: file.body
    })
  }

  private update(patch: Partial<MeetingSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }
}
