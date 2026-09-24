import { watch, type FSWatcher } from 'chokidar'

interface ExportWatcherOptions {
  /** Called once the export file has been created or changed and has stopped being written. */
  onChange: () => void
  /** How long the file must be quiet before onChange fires. Better BibTeX can write in pieces. */
  stabilityMs?: number
}

/** Watches the Zotero export file. Only ever reads; never touches the file. */
export class ExportWatcher {
  private watcher: FSWatcher | null = null
  private readonly onChange: () => void
  private readonly stabilityMs: number

  constructor({ onChange, stabilityMs = 1000 }: ExportWatcherOptions) {
    this.onChange = onChange
    this.stabilityMs = stabilityMs
  }

  /** Start watching `path`, replacing any previous watch. The file need not exist yet. */
  async watch(path: string): Promise<void> {
    await this.close()
    if (!path) return
    const watcher = watch(path, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: this.stabilityMs, pollInterval: 100 }
    })
    watcher.on('add', this.onChange).on('change', this.onChange)
    // A watcher error (e.g. permissions) must not crash the app; the next manual sync reports it.
    watcher.on('error', () => undefined)
    this.watcher = watcher
  }

  async close(): Promise<void> {
    const watcher = this.watcher
    this.watcher = null
    await watcher?.close()
  }
}
