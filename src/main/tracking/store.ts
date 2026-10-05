import { createHash, randomUUID } from 'crypto'
import { existsSync, readFileSync, readdirSync, renameSync } from 'fs'
import { join } from 'path'
import { WORKSPACES, type Workspace } from '@shared/settings'
import { parseYear, parsePlan } from '@shared/tracking/parse'
import { carrySeconds } from '@shared/tracking/rounding'
import {
  endSessionAt,
  runningSession,
  startSession,
  endFinishedDay,
  renameTask,
  setClient,
  stopSession,
  deleteSession
} from '@shared/tracking/timer'
import { addTime, setDayNote, setTaskMinutes } from '@shared/tracking/totals'
import { addTimeOff, editTimeOff, removeTimeOff } from '@shared/tracking/timeoff'
import type {
  RunningTimer,
  TimerResult,
  TrackingChangedEvent,
  YearResult
} from '@shared/tracking/api'
import {
  defaultPlan,
  emptyYear,
  type Change,
  type Moment,
  type Plan,
  type TimeOffType,
  type TrackingYear
} from '@shared/tracking/types'
import { dayNumber, inYear, yearEnd, yearLabel, yearStartOf, yearsPresent } from '@shared/year'
import { contractWeeks, hasContracts } from '@shared/tracking/workspace-weeks'
import { writeFileAtomicSync } from '../atomic-write'

export interface TrackingDeps {
  /** The year starts from Settings, oldest first. */
  starts: () => readonly string[]
  /** The local date and time of now. */
  now: () => Moment
  newId?: () => string
  onChange?: (event: TrackingChangedEvent) => void
  /** A seam for tests: runs after a change is worked out and before it is saved. */
  beforeCommit?: () => void
}

interface Loaded {
  year: TrackingYear
  /** The file's text as read, or null when there was no file. */
  text: string | null
}

const sha = (text: string): string => createHash('sha1').update(text, 'utf8').digest('hex')

/** `2026-09-21` is kept in `2026-27.json`. */
export function yearFileName(start: string, workspace = 'research'): string {
  // A contract starts on any date, so its file is named by it; a year by its two calendar years.
  return hasContracts(workspace) ? `${start}.json` : `${yearLabel(start).replace('–', '-')}.json`
}

const FILE = /^\d{4}-\d{2}(-\d{2})?\.json$/

/**
 * The year files: `<root>/<workspace>/2026-27.json`, one per workspace and year, human-readable. Everything here is
 * synchronous on purpose: the files are small, and a session started a moment before quitting must already be on
 * disk when the call returns. Reads always come from disk, so an edit made outside the app is simply picked up; a
 * save is refused (and redone from the fresh file) if the file changed between the read and the write.
 */
export class TrackingStore {
  private readonly newId: () => string

  constructor(
    private readonly root: string,
    private readonly deps: TrackingDeps
  ) {
    this.newId = deps.newId ?? (() => randomUUID().replace(/-/g, '').slice(0, 8))
  }

  // ---- reading ----

  /** The years to offer: every one with a file, plus the current one, newest first. */
  years(workspace: Workspace): string[] {
    const files = this.fileStarts(workspace)
    if (hasContracts(workspace)) return files
    const starts = this.deps.starts()
    return yearsPresent(files, this.deps.now().date, starts).filter(
      (y) => yearStartOf(y, starts) === y
    )
  }

  /** One year. The current year's file is created if it is missing (previous plan, carry passed on). */
  get(workspace: Workspace, year: string): TrackingYear {
    this.checkYear(workspace, year)
    const loaded = this.load(workspace, year)
    if (loaded.text === null && !hasContracts(workspace) && year === this.currentStart(workspace)) {
      this.commit(workspace, loaded, loaded.year)
    }
    return loaded.year
  }

  /** The running timer, wherever it is (every workspace, every year with a file). */
  running(): RunningTimer | null {
    for (const workspace of WORKSPACES) {
      for (const start of this.fileStarts(workspace)) {
        const year = this.peek(workspace, start)
        const session = year && runningSession(year)
        if (session) return { workspace, year: start, session }
      }
    }
    return null
  }

  // ---- the timer ----

  /**
   * Start a task now. Whatever runs stops at the same instant: in the same file that is one write, in another
   * workspace it is a stop and then a start (never two timers at once, even if the app dies between them).
   */
  start(workspace: Workspace, label: string, task?: string, client?: string): TimerResult {
    const now = this.deps.now()
    const year = this.currentStart(workspace)
    if (year === null) return { ok: false, reason: 'outside-year' }
    const running = this.running()
    if (running && !(running.workspace === workspace && running.year === year)) {
      const stopped = this.mutate(running.workspace, running.year, (y) => stopSession(y, now))
      if (!stopped.ok) return stopped
    }
    const result = this.mutate(workspace, year, (y) =>
      startSession(y, now, label, this.newId(), task, client)
    )
    return result.ok ? { ok: true, running: this.running() } : result
  }

  stop(): TimerResult {
    const running = this.running()
    if (!running) return { ok: true, running: null }
    const now = this.deps.now()
    const result = this.mutate(running.workspace, running.year, (y) => stopSession(y, now))
    return result.ok ? { ok: true, running: this.running() } : result
  }

  /** Stop a timer whose day has ended (04:00) at the day end. Called on a short interval and at launch. */
  closeFinishedDays(): void {
    const running = this.running()
    if (!running) return
    const now = this.deps.now()
    if (running.session.date >= now.date) return
    this.mutate(running.workspace, running.year, (y) => endFinishedDay(y, now))
  }

  endAt(workspace: Workspace, year: string, id: string, time: string): TimerResult {
    const result = this.mutate(workspace, year, (y) => endSessionAt(y, id, time))
    return result.ok ? { ok: true, running: this.running() } : result
  }

  // ---- editing ----

  deleteSession(workspace: Workspace, year: string, id: string): YearResult {
    return this.mutate(workspace, year, (y) => ({ ok: true, year: deleteSession(y, id) }))
  }

  setTaskMinutes(
    workspace: Workspace,
    year: string,
    date: string,
    label: string,
    minutes: number,
    client?: string
  ): YearResult {
    return this.mutate(workspace, year, (y) =>
      setTaskMinutes(y, date, label, minutes, this.newId(), client)
    )
  }

  renameTask(
    workspace: Workspace,
    year: string,
    date: string,
    from: string,
    to: string,
    client?: string
  ): YearResult {
    return this.mutate(workspace, year, (y) => renameTask(y, date, from, to, client))
  }

  setClient(
    workspace: Workspace,
    year: string,
    date: string,
    label: string,
    from: string | undefined,
    to: string
  ): YearResult {
    return this.mutate(workspace, year, (y) => setClient(y, date, label, from, to))
  }

  addTime(
    workspace: Workspace,
    year: string,
    date: string,
    label: string,
    minutes: number,
    client?: string
  ): YearResult {
    return this.mutate(workspace, year, (y) =>
      addTime(y, date, label, minutes, this.newId(), client)
    )
  }

  setNote(workspace: Workspace, year: string, date: string, note: string): YearResult {
    return this.mutate(workspace, year, (y) => setDayNote(y, date, note))
  }

  setPlan(workspace: Workspace, year: string, patch: Partial<Plan>): YearResult {
    return this.mutate(workspace, year, (y) => {
      const plan = parsePlan({ ...y.plan, ...patch })
      return plan ? { ok: true, year: { ...y, plan } } : { ok: false, reason: 'bad-plan' }
    })
  }

  addTimeOff(
    workspace: Workspace,
    year: string,
    from: string,
    to: string,
    type: TimeOffType
  ): YearResult {
    return this.mutate(workspace, year, (y) => addTimeOff(y, from, to, type))
  }

  editTimeOff(
    workspace: Workspace,
    year: string,
    from: string,
    to: string,
    type: TimeOffType
  ): YearResult {
    return this.mutate(workspace, year, (y) => editTimeOff(y, from, to, type))
  }

  removeTimeOff(workspace: Workspace, year: string, date: string): YearResult {
    return this.mutate(workspace, year, (y) => ({ ok: true, year: removeTimeOff(y, date) }))
  }

  /**
   * Start a contract (a Work year): its first and last day are the user's, whole weeks, and it may not overlap another.
   * It takes the previous contract's plan and its final rounding carry.
   */
  createContract(workspace: Workspace, start: string, end: string): YearResult {
    if (!hasContracts(workspace)) return { ok: false, reason: 'no-contracts' }
    if (dayNumber(start) === null || dayNumber(end) === null)
      return { ok: false, reason: 'bad-start' }
    const weeks = contractWeeks(start, end)
    if (!weeks.ok) return weeks
    if (this.overlaps(workspace, start, weeks.weeks, null)) return { ok: false, reason: 'overlap' }
    const year = { ...this.fresh(workspace, start), weeks: weeks.weeks }
    if (!this.commit(workspace, { year, text: null }, year)) {
      return { ok: false, reason: 'changed-on-disk' }
    }
    return { ok: true, year }
  }

  /** Move a contract's last day (whole weeks). Never past a day that holds time, and never into another contract. */
  setContractEnd(workspace: Workspace, start: string, end: string): YearResult {
    if (!hasContracts(workspace)) return { ok: false, reason: 'no-contracts' }
    const weeks = contractWeeks(start, end)
    if (!weeks.ok) return weeks
    if (this.overlaps(workspace, start, weeks.weeks, start)) return { ok: false, reason: 'overlap' }
    return this.mutate(workspace, start, (y) => {
      const last = yearEnd(start, weeks.weeks)
      const used = [...y.sessions, ...y.adjusts].some((s) => s.date > last)
      return used
        ? { ok: false, reason: 'has-time-after' }
        : { ok: true, year: { ...y, weeks: weeks.weeks } }
    })
  }

  /** Whether a contract of `weeks` weeks from `start` shares a day with another one (`except` is left out). */
  private overlaps(
    workspace: Workspace,
    start: string,
    weeks: number,
    except: string | null
  ): boolean {
    const end = yearEnd(start, weeks)
    return this.fileStarts(workspace).some((s) => {
      if (s === except) return false
      const other = this.peek(workspace, s)
      return other !== null && s <= end && yearEnd(s, other.weeks) >= start
    })
  }

  /**
   * Write a whole imported year. It never overwrites: a year whose file already holds anything (a session, typed
   * time, a day, a day off, a typed week) is refused. An empty year (the file the app creates on first read) is
   * replaced, keeping the carry it was given.
   */
  importYear(workspace: Workspace, imported: TrackingYear): YearResult {
    return this.mutate(workspace, imported.start, (current) => {
      const used =
        current.sessions.length +
        current.adjusts.length +
        current.timeOff.length +
        Object.keys(current.days).length +
        Object.keys(current.weekDays).length
      return used > 0
        ? { ok: false, reason: 'not-empty' }
        : { ok: true, year: { ...imported, carryIn: current.carryIn } }
    })
  }

  // ---- files ----

  private path(workspace: Workspace, start: string): string {
    return join(this.root, workspace, yearFileName(start, workspace))
  }

  private currentStart(workspace: Workspace): string | null {
    const today = this.deps.now().date
    if (hasContracts(workspace)) {
      return (
        this.fileStarts(workspace).find((s) => inYear(today, s, this.peek(workspace, s)?.weeks)) ??
        null
      )
    }
    return yearStartOf(today, this.deps.starts())
  }

  /** Only a year the shared list knows (every start, and the 52-week steps back from the first). */
  private checkYear(workspace: Workspace, start: string): void {
    if (hasContracts(workspace)) {
      if (!this.fileStarts(workspace).includes(start)) throw new Error('unknown-year')
      return
    }
    if (yearStartOf(start, this.deps.starts()) !== start) throw new Error('unknown-year')
  }

  /** The starts of the files in a workspace's folder, newest first. Reads only the names. */
  private fileStarts(workspace: Workspace): string[] {
    let names: string[]
    try {
      names = readdirSync(join(this.root, workspace)).filter((n) => FILE.test(n))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
    const starts: string[] = []
    for (const name of names) {
      const year = this.peekFile(join(this.root, workspace, name))
      if (year) starts.push(year.start)
    }
    return starts.sort().reverse()
  }

  /** A year read without side effects: null when there is no usable file. */
  private peek(workspace: Workspace, start: string): TrackingYear | null {
    const year = this.peekFile(this.path(workspace, start))
    return year && year.start === start ? year : null
  }

  private peekFile(path: string): TrackingYear | null {
    try {
      return parseYear(JSON.parse(readFileSync(path, 'utf8')))
    } catch {
      return null
    }
  }

  /**
   * A year as it is on disk. A file that is not a year file is set aside (never overwritten) and the year starts
   * afresh; one written by a newer version of the app is left alone and refused.
   */
  private load(workspace: Workspace, start: string): Loaded {
    const path = this.path(workspace, start)
    if (existsSync(path)) {
      const text = readFileSync(path, 'utf8')
      let json: unknown = null
      try {
        json = JSON.parse(text)
      } catch {
        // falls through to being set aside
      }
      const year = parseYear(json)
      if (year) {
        if (year.start !== start)
          throw new Error(`${yearFileName(start, workspace)} belongs to another year`)
        return { year, text }
      }
      const version = (json as { version?: unknown } | null)?.version
      if (typeof version === 'number' && version > 1) {
        throw new Error(
          `${yearFileName(start, workspace)} was written by a newer version of the app`
        )
      }
      renameSync(path, `${path}.corrupt-${Date.now()}`)
    }
    return { year: this.fresh(workspace, start), text: null }
  }

  /** A new year takes the previous one's plan and its final rounding carry. */
  private fresh(workspace: Workspace, start: string): TrackingYear {
    const before = this.fileStarts(workspace).find((s) => s < start)
    const previous = before === undefined ? null : this.peek(workspace, before)
    return previous
      ? emptyYear(start, previous.plan, carrySeconds(previous))
      : emptyYear(start, defaultPlan(workspace), 0)
  }

  /** Save `next` if the file still holds what was read. True when it is saved (or already was). */
  private commit(workspace: Workspace, loaded: Loaded, next: TrackingYear): boolean {
    const path = this.path(workspace, next.start)
    const text = JSON.stringify(next, null, 2) + '\n'
    this.deps.beforeCommit?.()
    const disk = existsSync(path) ? readFileSync(path, 'utf8') : null
    if (sha(disk ?? '') !== sha(loaded.text ?? '')) return false
    if (text === disk) return true
    writeFileAtomicSync(path, text)
    this.deps.onChange?.({ workspace, year: next.start })
    return true
  }

  /** Read, change, save: redone from the fresh file when it changed in between. */
  private mutate(
    workspace: Workspace,
    start: string,
    change: (year: TrackingYear) => Change
  ): YearResult {
    try {
      this.checkYear(workspace, start)
    } catch {
      return { ok: false, reason: 'unknown-year' }
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const loaded = this.load(workspace, start)
      const changed = change(loaded.year)
      if (!changed.ok) return changed
      if (this.commit(workspace, loaded, changed.year)) return { ok: true, year: changed.year }
    }
    return { ok: false, reason: 'changed-on-disk' }
  }
}
