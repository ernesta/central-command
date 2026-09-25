import type { NoteContent } from '@shared/notes'
import { friendlyFileError, ipcErrorMessage } from '@renderer/lib/ipc-error'
import type { SaveState } from './notes-session'

/** An entry (meeting, training entry…) as read from disk, split into its parts. */
export interface EntryFile<R, M> {
  ref: R
  note: NoteContent
  meta: M
  body: string
  problems: string[]
  /** The file's modified time in milliseconds, for kinds of entry that show it. */
  edited?: number
}

export type EntrySaveResult =
  { status: 'saved'; hash: string; renamedTo?: string } | { status: 'conflict'; disk: NoteContent }

export interface EntryChangedEvent<R> {
  ref: R
  /** Hash of the whole file now; null when the file was removed. */
  hash: string | null
}

/** What a save may change: front matter fields (only those listed) and/or the whole body. */
export interface EntryChanges<M> {
  meta?: Partial<M>
  body?: string
}

/** The slice of a module's API an entry session needs. */
export interface EntrySessionApi<R, M> {
  read(ref: R): Promise<EntryFile<R, M>>
  save(ref: R, changes: EntryChanges<M>, baseHash: string): Promise<EntrySaveResult>
  onChanged(listener: (event: EntryChangedEvent<R>) => void): () => void
}

/** What the other version of the file looks like, for the conflict notice. */
export interface DiskVersion<M> {
  note: NoteContent
  meta: M
  body: string
}

export interface EntrySnapshot<M> {
  status: 'loading' | 'ready' | 'missing'
  /** The entry's fields as shown: saved values with any unsaved edits on top. */
  meta: M
  /** What is wrong with the front matter, if anything. */
  problems: string[]
  /** The note text as it stands now. */
  body: string
  /** The Markdown the editor should be (re)created with. Only changes when `editorKey` does. */
  initialBody: string
  /** Changes whenever the editor must be recreated (first load, body changed on disk, topic added). */
  editorKey: number
  save: SaveState
  error: string | null
  /** Set when the file changed on disk while we have unsaved edits; saving is paused until resolved. */
  conflict: DiskVersion<M> | null
  /** True after the entry was refreshed from disk because another tool changed it. */
  reloadedFromDisk: boolean
  /** When the file was last changed (milliseconds): as read from disk, or when this session last saved it. Null if unknown. */
  updatedAt: number | null
}

/** What differs between kinds of entry. */
export interface EntrySessionConfig<M> {
  emptyMeta: M
  /** Split the whole file into the fields and the body, for the conflict notice. */
  parseDisk(note: NoteContent): { meta: M; body: string }
  /** Matches the error message for a file that is gone. */
  missingPattern: RegExp
  /** "meeting", for "the file for this meeting has been moved or deleted…". */
  noun: string
}

export interface EntrySessionOptions {
  /** How long after the last edit to save. */
  debounceMs?: number
  /** Called when saving renamed the entry's file, with the new id. */
  onRenamed?: (id: string) => void
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/**
 * One entry being edited: its fields and its note together, saved as one file. Framework-free so
 * it can be tested with a fake disk.
 *
 * Rules that protect the user's writing (the same ones as `NotesSession`):
 * - Every save says which version of the file it builds on; if the file moved on, nothing is written
 *   and the user chooses to keep their version or take the file's.
 * - A change on disk while nothing is unsaved is simply loaded in (the editor is only recreated when
 *   the note text itself changed, so editing a field elsewhere never disturbs the cursor).
 * - A subclass may prepare the file when it opens (Meetings adds carried-over TODOs, adds only).
 */
export class EntrySession<R extends { id: string; workspace: string }, M> {
  private snapshot: EntrySnapshot<M>
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
  private savedMeta: M
  private savedBody = ''
  private latestBody = ''
  private pendingMeta: Partial<M> = {}

  constructor(
    protected ref: R,
    protected readonly api: EntrySessionApi<R, M>,
    private readonly config: EntrySessionConfig<M>,
    options: EntrySessionOptions = {}
  ) {
    this.debounceMs = options.debounceMs ?? 500
    this.onRenamed = options.onRenamed
    this.savedMeta = config.emptyMeta
    this.snapshot = {
      status: 'loading',
      meta: config.emptyMeta,
      problems: [],
      body: '',
      initialBody: '',
      editorKey: 0,
      save: 'clean',
      error: null,
      conflict: null,
      reloadedFromDisk: false,
      updatedAt: null
    }
  }

  getSnapshot = (): EntrySnapshot<M> => this.snapshot

  /** Set who to tell when saving renames the entry's file. */
  setOnRenamed = (listener: ((id: string) => void) | undefined): void => {
    this.onRenamed = listener
  }

  /** True after `dispose()` until `start()` runs again. */
  isDisposed = (): boolean => this.disposed

  /** Which entry this is now (its id changes when an edit renames the file). */
  getRef = (): R => this.ref

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Begin listening for outside changes and load the entry. Safe to call again after `dispose()`
   * (React StrictMode mounts, unmounts and remounts a component in development).
   */
  async start(): Promise<void> {
    this.disposed = false
    this.unsubscribe?.()
    this.unsubscribe = this.api.onChanged((event) => void this.onExternalChange(event))

    let file: EntryFile<R, M>
    try {
      file = await this.api.read(this.ref)
    } catch {
      if (!this.disposed) this.update({ status: 'missing' })
      return
    }
    if (this.disposed) return
    try {
      file = await this.prepare(file)
    } catch {
      // Preparing is a convenience; the entry opens without it.
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

  /** Called with the file just read, before it is shown; may return a newer read of it. */
  protected prepare(file: EntryFile<R, M>): Promise<EntryFile<R, M>> {
    return Promise.resolve(file)
  }

  /** Called on every change from the editor. */
  editBody(markdown: string): void {
    if (this.disposed || this.snapshot.status !== 'ready') return
    this.latestBody = markdown
    this.markDirty({ body: markdown, reloadedFromDisk: false })
  }

  /** Change one or more fields. Only these keys are written; everything else in the file is left alone. */
  setMeta(patch: Partial<M>): void {
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

  private diskVersion(note: NoteContent): DiskVersion<M> {
    return { note, ...this.config.parseDisk(note) }
  }

  private hasPending(): boolean {
    return Object.keys(this.pendingMeta).length > 0 || this.latestBody !== this.savedBody
  }

  private markDirty(patch: Partial<EntrySnapshot<M>>): void {
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
    const changes: EntryChanges<M> = {}
    if (Object.keys(sentMeta).length > 0) changes.meta = sentMeta
    if (sentBody !== this.savedBody) changes.body = sentBody
    this.update({ save: 'saving', error: null })

    let result: EntrySaveResult
    try {
      result = await this.api.save(this.ref, changes, this.baseHash)
    } catch (error) {
      const message = ipcErrorMessage(error)
      this.update({
        save: 'error',
        error: this.config.missingPattern.test(message)
          ? `the file for this ${this.config.noun} has been moved or deleted, so it cannot be saved. Your text is still here.`
          : friendlyFileError(message)
      })
      return
    }
    if (result.status === 'conflict') {
      this.update({ conflict: this.diskVersion(result.disk), save: 'dirty' })
      return
    }
    this.baseHash = result.hash
    if (result.renamedTo) {
      // The file now has a name that matches its details; keep talking about the same entry.
      this.ref = { ...this.ref, id: result.renamedTo }
      this.onRenamed?.(result.renamedTo)
    }
    this.savedBody = sentBody
    this.savedMeta = { ...this.savedMeta, ...sentMeta }
    // Keep any field that was edited again while the save was running.
    const remaining: Partial<M> = {}
    for (const [key, value] of Object.entries(this.pendingMeta)) {
      if (!same(value, (sentMeta as Record<string, unknown>)[key])) {
        ;(remaining as Record<string, unknown>)[key] = value
      }
    }
    this.pendingMeta = remaining
    const dirty = this.hasPending()
    this.update({ save: dirty ? 'dirty' : 'clean', updatedAt: Date.now() })
    if (dirty) this.saveAgain = true
  }

  private async onExternalChange(event: EntryChangedEvent<R>): Promise<void> {
    if (this.disposed || this.snapshot.status !== 'ready') return
    if (event.ref.id !== this.ref.id || event.ref.workspace !== this.ref.workspace) return
    if (event.hash === this.baseHash || this.inflight) return

    if (event.hash === null) {
      // Deleted (here or elsewhere). Keep what is on screen; the next save reports the missing file.
      return
    }
    let file: EntryFile<R, M>
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
      this.update({ conflict: this.diskVersion(file.note) })
    }
  }

  /** Treat `file` as the current state of the file on disk. */
  private adopt(file: EntryFile<R, M>): void {
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
      initialBody: file.body,
      updatedAt: file.edited ?? this.snapshot.updatedAt
    })
  }

  private update(patch: Partial<EntrySnapshot<M>>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }
}
