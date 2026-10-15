import type { Database } from 'better-sqlite3'
import type { CheckOutcome } from '../shared/types'
import { checkSource, dueSources, type Fetcher } from './checker'
import { getSource, listSources } from './repository'

export interface SchedulerOptions {
  db: Database
  fetcher: Fetcher
  now?: () => string
  /** Pause between two requests, so one run does not hit sites in a burst. */
  gapMs?: number
  sleep?: (ms: number) => Promise<void>
  /** Called after every run that checked something. */
  onChange?: (outcomes: CheckOutcome[]) => void
}

/**
 * Checks sources one at a time. A run that is already going is joined, not doubled, so a click on "Check now"
 * while the hourly pass is running does not send two requests to the same site.
 */
export class WatchScheduler {
  private running: Promise<CheckOutcome[]> | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly now: () => string
  private readonly gapMs: number
  private readonly sleep: (ms: number) => Promise<void>

  constructor(private readonly options: SchedulerOptions) {
    this.now = options.now ?? ((): string => new Date().toISOString())
    this.gapMs = options.gapMs ?? 2000
    this.sleep = options.sleep ?? ((ms): Promise<void> => new Promise((r) => setTimeout(r, ms)))
  }

  /** Check what is due now. */
  runDue(): Promise<CheckOutcome[]> {
    return this.run(() => dueSources(listSources(this.options.db), this.now()).map((s) => s.id))
  }

  /** Check one source now, or every active source when no id is given, due or not. */
  checkNow(sourceId?: number): Promise<CheckOutcome[]> {
    return this.run(() =>
      sourceId === undefined
        ? listSources(this.options.db)
            .filter((s) => s.active)
            .map((s) => s.id)
        : [sourceId]
    )
  }

  private run(pick: () => number[]): Promise<CheckOutcome[]> {
    if (this.running) return this.running
    const pass = (async (): Promise<CheckOutcome[]> => {
      const outcomes: CheckOutcome[] = []
      const ids = pick()
      for (const [index, id] of ids.entries()) {
        const source = getSource(this.options.db, id)
        if (!source) continue
        if (index > 0) await this.sleep(this.gapMs)
        outcomes.push(await checkSource(this.options.db, source, this.options.fetcher, this.now()))
      }
      if (outcomes.length > 0) this.options.onChange?.(outcomes)
      return outcomes
    })().finally(() => {
      this.running = null
    })
    this.running = pass
    return pass
  }

  /** Look for due sources shortly after launch and then every `everyMs` (default an hour). */
  start(firstAfterMs = 30_000, everyMs = 3_600_000): void {
    this.stop()
    const tick = (): void => {
      void this.runDue().catch(() => undefined)
    }
    const first = setTimeout(tick, firstAfterMs)
    this.timer = setInterval(tick, everyMs)
    this.stopFirst = (): void => clearTimeout(first)
  }

  private stopFirst: (() => void) | null = null

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.stopFirst?.()
    this.timer = null
    this.stopFirst = null
  }
}
