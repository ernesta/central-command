import type { NoteChangedEvent, NoteContent, NoteWriteResult } from '../shared/notes'

/** The slice of the Readings API a notes session needs. */
export interface NotesApi {
  read(citekey: string): Promise<NoteContent>
  write(citekey: string, content: string, baseHash: string): Promise<NoteWriteResult>
  onChanged(listener: (event: NoteChangedEvent) => void): () => void
}

export type SaveState = 'clean' | 'dirty' | 'saving' | 'error'

export interface NotesSnapshot {
  status: 'loading' | 'ready'
  /** The Markdown the editor should be (re)created with. Only changes when `editorKey` does. */
  initial: string
  /** Changes whenever the editor must be recreated with new content (first load, reload from disk). */
  editorKey: number
  save: SaveState
  error: string | null
  /** Set when the file changed on disk while we have unsaved edits; saving is paused until resolved. */
  conflict: NoteContent | null
  /** True after the note was refreshed from disk because another tool changed it. */
  reloadedFromDisk: boolean
  /** Whether the note currently has any text (drives the Saved indicator). */
  hasContent: boolean
}

interface Options {
  /** How long after the last keystroke to save. */
  debounceMs?: number
}

/**
 * The state of one note being edited: loading it, autosaving edits, and reacting to the
 * file changing underneath us. Framework-free so it can be tested with a fake disk.
 *
 * Rules that protect the user's writing:
 * - Every save says which version it builds on; if the file moved on, nothing is written
 *   and the user chooses ("Keep mine" or "Use the file's version").
 * - A change on disk while the editor is clean is simply loaded in.
 * - Our own saves echo back as change events. Each event is re-checked against the file's
 *   actual content, so an echo (however late) never looks like someone else's edit.
 */
export class NotesSession {
  private snapshot: NotesSnapshot = {
    status: 'loading',
    initial: '',
    editorKey: 0,
    save: 'clean',
    error: null,
    conflict: null,
    reloadedFromDisk: false,
    hasContent: false
  }
  private readonly listeners = new Set<() => void>()
  private readonly debounceMs: number
  private timer: ReturnType<typeof setTimeout> | null = null
  private inflight: Promise<void> | null = null
  private saveAgain = false
  private disposed = false
  private readonly unsubscribe: () => void

  /** Hash of the file version our next save builds on. */
  private baseHash = ''
  /** What is on disk (as far as we know) and what the editor holds now. */
  private savedContent = ''
  private latest = ''

  constructor(
    private readonly citekey: string,
    private readonly api: NotesApi,
    options: Options = {}
  ) {
    this.debounceMs = options.debounceMs ?? 500
    this.unsubscribe = api.onChanged((event) => void this.onExternalChange(event))
  }

  getSnapshot = (): NotesSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async load(): Promise<void> {
    const note = await this.api.read(this.citekey)
    if (this.disposed) return
    this.adoptDisk(note)
    this.update({
      status: 'ready',
      initial: note.content,
      editorKey: this.snapshot.editorKey + 1,
      save: 'clean',
      error: null,
      conflict: null,
      hasContent: note.content.trim() !== ''
    })
  }

  /** Called on every change from the editor. */
  edit(markdown: string): void {
    if (this.disposed || this.snapshot.status !== 'ready') return
    this.latest = markdown
    const dirty = markdown !== this.savedContent
    this.update({
      save: this.snapshot.save === 'saving' && dirty ? 'saving' : dirty ? 'dirty' : 'clean',
      hasContent: markdown.trim() !== '',
      reloadedFromDisk: false
    })
    if (this.timer) clearTimeout(this.timer)
    this.timer = dirty ? setTimeout(() => void this.flush(), this.debounceMs) : null
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
    if (this.latest === this.savedContent) return
    this.inflight = this.saveOnce().finally(() => {
      this.inflight = null
    })
    await this.inflight
    if (this.saveAgain) {
      this.saveAgain = false
      await this.flush()
    }
  }

  /** Resolve a conflict by keeping our version: overwrite the file. */
  async keepMine(): Promise<void> {
    const conflict = this.snapshot.conflict
    if (!conflict) return
    this.baseHash = conflict.hash
    this.update({ conflict: null, save: 'dirty' })
    await this.flush()
  }

  /** Resolve a conflict by taking the file's version: replace the editor content. */
  async useDisk(): Promise<void> {
    const conflict = this.snapshot.conflict
    if (!conflict) return
    this.adoptDisk(conflict)
    this.update({
      initial: conflict.content,
      editorKey: this.snapshot.editorKey + 1,
      save: 'clean',
      error: null,
      conflict: null,
      hasContent: conflict.content.trim() !== '',
      reloadedFromDisk: false
    })
  }

  /** Stop listening and save anything pending. Safe to call more than once. */
  async dispose(): Promise<void> {
    if (this.disposed) return
    await this.flush()
    this.disposed = true
    this.unsubscribe()
    this.listeners.clear()
  }

  private async saveOnce(): Promise<void> {
    const content = this.latest
    this.update({ save: 'saving', error: null })
    let result: NoteWriteResult
    try {
      result = await this.api.write(this.citekey, content, this.baseHash)
    } catch (error) {
      this.update({
        save: 'error',
        error: error instanceof Error ? error.message : String(error)
      })
      return
    }
    if (result.status === 'conflict') {
      this.update({ conflict: result.disk, save: 'dirty' })
      return
    }
    this.baseHash = result.hash
    this.savedContent = content
    this.update({ save: this.latest === content ? 'clean' : 'dirty' })
    if (this.latest !== content) this.saveAgain = true
  }

  private async onExternalChange(event: NoteChangedEvent): Promise<void> {
    if (this.disposed || event.citekey !== this.citekey || this.snapshot.status !== 'ready') return
    if (event.hash === this.baseHash) return

    const disk = await this.api.read(this.citekey)
    if (this.disposed || disk.hash === this.baseHash) return

    // The file already holds exactly what the editor holds (e.g. the echo of our own save
    // arrived before the save's reply): nothing to reload, and nothing to fight over.
    if (disk.content === this.latest) {
      this.baseHash = disk.hash
      this.savedContent = disk.content
      if (!this.inflight) this.update({ save: 'clean' })
      return
    }

    const editorClean = this.latest === this.savedContent && !this.inflight
    if (editorClean) {
      this.adoptDisk(disk)
      this.update({
        initial: disk.content,
        editorKey: this.snapshot.editorKey + 1,
        save: 'clean',
        conflict: null,
        hasContent: disk.content.trim() !== '',
        reloadedFromDisk: true
      })
    } else {
      this.update({ conflict: disk })
    }
  }

  /** Treat `note` as the current state of the file. */
  private adoptDisk(note: NoteContent): void {
    this.baseHash = note.hash
    this.savedContent = note.content
    this.latest = note.content
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private update(patch: Partial<NotesSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }
}
