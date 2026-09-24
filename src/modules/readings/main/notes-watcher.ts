import { watch, type FSWatcher } from 'chokidar'
import { basename } from 'path'

interface NotesWatcherOptions {
  dir: string
  /** Called with the file name (e.g. "smith2020.md") after a note was added, changed or removed. */
  onNoteChanged: (fileName: string) => void
  stabilityMs?: number
}

/**
 * Watches the notes folder so edits made outside the app (Claude Code, a text editor,
 * sync tools) are noticed. Also reports the app's own saves; consumers compare hashes.
 */
export class NotesWatcher {
  private watcher: FSWatcher | null = null

  constructor(private readonly options: NotesWatcherOptions) {}

  start(): void {
    if (this.watcher) return
    const { dir, onNoteChanged, stabilityMs = 250 } = this.options
    const handle = (path: string): void => {
      const name = basename(path)
      // Ignore the temp files atomic writes create, and anything that is not a note.
      if (name.startsWith('.') || !name.endsWith('.md')) return
      onNoteChanged(name)
    }
    this.watcher = watch(dir, {
      ignoreInitial: true,
      depth: 0,
      awaitWriteFinish: { stabilityThreshold: stabilityMs, pollInterval: 50 }
    })
    this.watcher.on('add', handle).on('change', handle).on('unlink', handle)
    this.watcher.on('error', () => undefined)
  }

  async close(): Promise<void> {
    const watcher = this.watcher
    this.watcher = null
    await watcher?.close()
  }
}
