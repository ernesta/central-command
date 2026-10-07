import { createHash, randomUUID } from 'crypto'
import { existsSync, readFileSync, readdirSync, renameSync } from 'fs'
import { join } from 'path'
import { WORKSPACES, type Workspace } from '@shared/settings'
import { parseYear, parsePlan } from '@shared/tracking/parse'
import { carrySeconds } from '@shared/tracking/rounding'
import {
  assignTask,
  endSessionAt,
  runningSession,
  setStartAt,
  startSession,
  endFinishedDay,
  renameTask,
  setClient,
  stopSession,
  deleteSession
} from '@shared/tracking/timer'
import { linkEntries } from './import/work-task-links'
import { applyEntryLinks, markEarlier } from './import/work-links-apply'
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
  type ContractTerms,
  type Moment,
  type Plan,
  type TimeOffType,
  type TrackingYear
} from '@shared/tracking/types'
import { dayNumber, inYear, yearEnd, yearLabel, yearStartOf, yearsPresent } from '@shared/year'
import { contractWeeks, hasContracts } from '@shared/tracking/workspace-weeks'
import {
  contractForClient,
  contractOfLastClient,
  openContracts,
  type OpenContracts
} from '@shared/tracking/contracts'
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
    if (
      loaded.text === null &&
      !hasContracts(workspace) &&
      year === yearStartOf(this.deps.now().date, this.deps.starts())
    ) {
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
   * Start a task now, in the contract of its client (see `startingYear`). Whatever runs stops at the same instant: in the same file that is one write, in another
   * workspace it is a stop and then a start (never two timers at once, even if the app dies between them).
   */
  start(workspace: Workspace, label: string, task?: string, client?: string): TimerResult {
    const now = this.deps.now()
    const found = this.startingYear(workspace, client)
    if (!found.ok) return found
    const year = found.year
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

  /** What a timer can start for today: every contract that holds today (Work) with its clients. */
  openContracts(workspace: Workspace): OpenContracts {
    return openContracts(this.holdingToday(workspace), this.deps.now().date)
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

  /**
   * Give the running timer its task (see `assignTask`). When the task's client belongs to another contract than the one
   * holding the timer, the session moves there: written to the new file first, then taken out of the old, so a crash leaves
   * the timer twice, never nowhere.
   */
  assignTask(
    workspace: Workspace,
    year: string,
    id: string,
    label: string,
    task: string,
    client?: string
  ): TimerResult {
    const target =
      client !== undefined && hasContracts(workspace)
        ? this.startingYear(workspace, client)
        : { ok: true as const, year }
    if (!target.ok) return target
    if (target.year === year) {
      const here = this.mutate(workspace, year, (y) => assignTask(y, id, label, task, client))
      return here.ok ? { ok: true, running: this.running() } : here
    }
    // The client is in another contract: build the session there, then take it out of this one.
    const session = this.peek(workspace, year)?.sessions.find((s) => s.id === id)
    if (!session) return { ok: false, reason: 'not-running' }
    const moved = this.mutate(workspace, target.year, (y) => {
      const assigned = assignTask(
        { ...y, sessions: [...y.sessions, session] },
        id,
        label,
        task,
        client
      )
      return assigned
    })
    if (!moved.ok) return moved
    const left = this.mutate(workspace, year, (y) => ({ ok: true, year: deleteSession(y, id) }))
    if (!left.ok) return left
    return { ok: true, running: this.running() }
  }

  /** Change when the running timer started (see `setStartAt`). */
  setStart(workspace: Workspace, year: string, id: string, time: string): TimerResult {
    const now = this.deps.now()
    const result = this.mutate(workspace, year, (y) => setStartAt(y, id, time, now))
    return result.ok ? { ok: true, running: this.running() } : result
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
    client?: string,
    task?: string
  ): YearResult {
    return this.mutate(workspace, year, (y) =>
      addTime(y, date, label, minutes, this.newId(), client, task)
    )
  }

  /** Link imported history to tasks (a one-off; see `linkEntries`). */
  linkHistory(
    workspace: Workspace,
    year: string,
    links: { id: string; uid: string }[]
  ): YearResult {
    return this.mutate(workspace, year, (y) => linkEntries(y, links))
  }

  /** Give a year's entries and timer sessions their tasks (a one-off; see `applyEntryLinks`). */
  linkAll(
    workspace: Workspace,
    year: string,
    links: { id: string; task: string; earlier: boolean }[]
  ): YearResult {
    return this.mutate(workspace, year, (y) => applyEntryLinks(y, links))
  }

  /** Mark linked typed entries as held by ClickUp's time (a one-off; see `markEarlier`). */
  markEarlier(workspace: Workspace, year: string, ids: string[]): YearResult {
    return this.mutate(workspace, year, (y) => markEarlier(y, ids))
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
   * Start a contract (a Work year): its first and last day are the user's, whole weeks. Contracts may overlap, but
   * never start on the same day (the file is named by it) and never share a client on any day (the client is how an
   * entry knows its contract). It has a plan of its own, not the previous contract's: `terms` say its clients and
   * weekly aim (0 is no fixed hours), and what they leave out comes from `defaultPlan`. Nothing is carried over, so
   * the rounding carry starts at 0.
   */
  createContract(
    workspace: Workspace,
    start: string,
    end: string,
    terms: ContractTerms = {}
  ): YearResult {
    if (!hasContracts(workspace)) return { ok: false, reason: 'no-contracts' }
    if (dayNumber(start) === null || dayNumber(end) === null)
      return { ok: false, reason: 'bad-start' }
    const weeks = contractWeeks(start, end)
    if (!weeks.ok) return weeks
    const name = terms.name?.trim()
    if (terms.name !== undefined && !name) return { ok: false, reason: 'bad-name' }
    if (this.fileStarts(workspace).includes(start)) return { ok: false, reason: 'same-start' }
    const base = defaultPlan(workspace)
    const plan = parsePlan({
      ...base,
      ...(terms.clients ? { clients: terms.clients } : {}),
      ...(terms.weeklyMinutes !== undefined ? { hoursPerWeek: terms.weeklyMinutes } : {})
    })
    if (!plan) return { ok: false, reason: 'bad-plan' }
    if (this.sharesClient(workspace, start, weeks.weeks, null, plan.clients ?? [])) {
      return { ok: false, reason: 'client-overlap' }
    }
    const year: TrackingYear = {
      ...emptyYear(start, plan, 0),
      weeks: weeks.weeks,
      ...(name ? { name } : {}),
      ...(terms.invoice ? { invoice: terms.invoice } : {})
    }
    if (!this.commit(workspace, { year, text: null }, year)) {
      return { ok: false, reason: 'changed-on-disk' }
    }
    return { ok: true, year }
  }

  /**
   * Move a contract's last day (whole weeks). Never past a day that holds time. It may run into another contract,
   * but not one that has a client of its own on the days gained.
   */
  setContractEnd(workspace: Workspace, start: string, end: string): YearResult {
    if (!hasContracts(workspace)) return { ok: false, reason: 'no-contracts' }
    const weeks = contractWeeks(start, end)
    if (!weeks.ok) return weeks
    const own = this.peek(workspace, start)?.plan.clients ?? []
    if (this.sharesClient(workspace, start, weeks.weeks, start, own)) {
      return { ok: false, reason: 'client-overlap' }
    }
    return this.mutate(workspace, start, (y) => {
      const last = yearEnd(start, weeks.weeks)
      const used = [...y.sessions, ...y.adjusts].some((s) => s.date > last)
      return used
        ? { ok: false, reason: 'has-time-after' }
        : { ok: true, year: { ...y, weeks: weeks.weeks } }
    })
  }

  /**
   * Whether another contract (`except` is left out) shares a day with one of `weeks` weeks from `start` and has one
   * of `clients` (compared ignoring case).
   */
  private sharesClient(
    workspace: Workspace,
    start: string,
    weeks: number,
    except: string | null,
    clients: readonly string[]
  ): boolean {
    const mine = new Set(clients.map((c) => c.toLowerCase()))
    const end = yearEnd(start, weeks)
    return this.fileStarts(workspace).some((s) => {
      if (s === except) return false
      const other = this.peek(workspace, s)
      if (!other || s > end || yearEnd(s, other.weeks) < start) return false
      return (other.plan.clients ?? []).some((c) => mine.has(c.toLowerCase()))
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

  /** Every contract (Work) that holds today, newest start first. */
  private holdingToday(workspace: Workspace): TrackingYear[] {
    const today = this.deps.now().date
    const years: TrackingYear[] = []
    for (const start of this.fileStarts(workspace)) {
      const year = this.peek(workspace, start)
      if (year && inYear(today, start, year.weeks)) years.push(year)
    }
    return years
  }

  /**
   * The year a timer starts in. A workspace with the shared year has one. With contracts, the contract is found from
   * the client: the one holding today that has it; with no client, the one of the client used last. Several may hold
   * today (they overlap), but a client is in one of them.
   */
  private startingYear(
    workspace: Workspace,
    client: string | undefined
  ): { ok: true; year: string } | { ok: false; reason: string } {
    const today = this.deps.now().date
    if (!hasContracts(workspace)) {
      const year = yearStartOf(today, this.deps.starts())
      return year === null ? { ok: false, reason: 'outside-year' } : { ok: true, year }
    }
    const open = this.holdingToday(workspace)
    if (open.length === 0) return { ok: false, reason: 'outside-year' }
    // A client no contract has falls to the first one, which refuses it (`bad-client`) without changing anything.
    const chosen =
      client === undefined
        ? contractOfLastClient(open, today)
        : (contractForClient(open, today, client) ?? open[0])
    return { ok: true, year: chosen!.start }
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
