import { readFile } from 'fs/promises'
import type { Database } from 'better-sqlite3'
import type { SyncStatus } from '../shared/types'
import { parseBib } from './parse-bib'
import { applySync, lastSyncRun, recordSyncRun } from './repository'

interface SyncServiceOptions {
  db: Database
  /** Read on every sync, so a changed setting takes effect without a restart. */
  getExportPath: () => string
  now?: () => Date
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Reads the Zotero export and applies it to the database. It only ever reads
 * the export. A failed parse or read changes nothing except a `sync_runs` row.
 */
export class SyncService {
  private readonly db: Database
  private readonly getExportPath: () => string
  private readonly now: () => Date
  private current: SyncStatus
  private inflight: Promise<void> | null = null
  private rerunRequested = false
  private readonly listeners = new Set<(status: SyncStatus) => void>()

  constructor({ db, getExportPath, now = () => new Date() }: SyncServiceOptions) {
    this.db = db
    this.getExportPath = getExportPath
    this.now = now
    this.current = this.initialStatus()
  }

  status(): SyncStatus {
    return this.current
  }

  onStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Run a sync. If one is already running, another pass is queued after it
   * (the file may have changed meanwhile) and the same promise is returned, so
   * a burst of triggers never overlaps or piles up.
   */
  sync(): Promise<SyncStatus> {
    if (this.inflight) {
      this.rerunRequested = true
    } else {
      this.inflight = this.runLoop().finally(() => {
        this.inflight = null
      })
    }
    return this.inflight.then(() => this.current)
  }

  private initialStatus(): SyncStatus {
    const lastRun = lastSyncRun(this.db)
    const lastOk = lastSyncRun(this.db, 'ok')
    return {
      state: lastRun === null ? 'not_configured' : lastRun.status === 'ok' ? 'idle' : 'error',
      lastRun,
      lastSuccessAt: lastOk?.finishedAt ?? null,
      message: lastRun?.status === 'error' ? lastRun.errorMessage : null
    }
  }

  private setStatus(patch: Partial<SyncStatus>): void {
    this.current = { ...this.current, ...patch }
    for (const listener of this.listeners) listener(this.current)
  }

  private async runLoop(): Promise<void> {
    do {
      this.rerunRequested = false
      await this.runOnce()
    } while (this.rerunRequested)
  }

  private async runOnce(): Promise<void> {
    const startedAt = this.now().toISOString()
    this.setStatus({ state: 'syncing' })

    const path = this.getExportPath()
    let text: string
    try {
      text = await readFile(path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Not set up yet: a setup state, not an error, and nothing to record.
        this.setStatus({ state: 'not_configured', message: null })
        return
      }
      this.fail(startedAt, `Couldn't read the Zotero export: ${errorMessage(error)}`)
      return
    }

    try {
      const entries = parseBib(text)
      const finishedAt = this.now().toISOString()
      const counts = applySync(this.db, entries, finishedAt)
      const run = { startedAt, finishedAt, status: 'ok' as const, ...counts, errorMessage: null }
      recordSyncRun(this.db, run)
      this.setStatus({ state: 'idle', lastRun: run, lastSuccessAt: finishedAt, message: null })
    } catch (error) {
      this.fail(startedAt, errorMessage(error))
    }
  }

  private fail(startedAt: string, message: string): void {
    const run = {
      startedAt,
      finishedAt: this.now().toISOString(),
      status: 'error' as const,
      entriesSeen: 0,
      inserted: 0,
      updated: 0,
      flaggedMissing: 0,
      errorMessage: message
    }
    try {
      recordSyncRun(this.db, run)
    } catch {
      // The database itself is failing; still surface the error in the UI.
    }
    this.setStatus({ state: 'error', lastRun: run, message })
  }
}
