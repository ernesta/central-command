import { inYear } from '../year'
import { carrySeconds, exactSeconds, reportFor, timeToSeconds } from './rounding'
import type { Change, Moment, Session, TrackingYear } from './types'

/** Two task names are the same task when they match after trimming and ignoring case. */
export function sameLabel(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** The running session, if any. At most one runs. */
export function runningSession(year: TrackingYear): Session | null {
  return year.sessions.find((s) => s.end === null) ?? null
}

/** End a session at `time` on its own day, reporting its minutes against the running carry. */
function close(year: TrackingYear, session: Session, time: string): Change {
  const end = timeToSeconds(time)
  const start = timeToSeconds(session.start)
  if (end === null || start === null) return { ok: false, reason: 'bad-time' }
  if (end < start) return { ok: false, reason: 'before-start' }
  const ended: Session = { ...session, end: time }
  // The carry is worked out without this session, which is not yet ended.
  const minutes = reportFor(carrySeconds(year), exactSeconds(ended))
  const sessions = year.sessions.map((s) => (s.id === session.id ? { ...ended, minutes } : s))
  return { ok: true, year: { ...year, sessions } }
}

/**
 * Start a task. A task may be started without a name (the label is then empty) and named later with `renameTask`.
 * Starting while another task runs stops that one at the same instant (one change, so switching is
 * one click). A session still running from an earlier day blocks a start until it is given an end time. Starting
 * the task that is already running changes nothing.
 */
export function startSession(
  year: TrackingYear,
  now: Moment,
  label: string,
  id: string,
  task?: string
): Change {
  const name = label.trim()
  if (!inYear(now.date, year.start)) return { ok: false, reason: 'outside-year' }
  if (timeToSeconds(now.time) === null) return { ok: false, reason: 'bad-time' }
  let current = year
  const running = runningSession(year)
  if (running) {
    if (running.date !== now.date) return { ok: false, reason: 'stale' }
    if (sameLabel(running.label, name)) return { ok: true, year }
    const stopped = close(year, running, now.time)
    if (!stopped.ok) return stopped
    current = stopped.year
  }
  const session: Session = {
    id,
    date: now.date,
    start: now.time,
    end: null,
    label: name,
    ...(task ? { task } : {})
  }
  return { ok: true, year: { ...current, sessions: [...current.sessions, session] } }
}

/** Stop the running task now. A session from an earlier day is not stopped by the clock: it needs an end time. */
export function stopSession(year: TrackingYear, now: Moment): Change {
  const running = runningSession(year)
  if (!running) return { ok: true, year }
  if (running.date !== now.date) return { ok: false, reason: 'stale' }
  return close(year, running, now.time)
}

/** Give a running session (typically one left running overnight) an end time on its own day. */
export function endSessionAt(year: TrackingYear, id: string, time: string): Change {
  const session = year.sessions.find((s) => s.id === id)
  if (!session || session.end !== null) return { ok: false, reason: 'not-running' }
  return close(year, session, time)
}

/** Remove a session. Nothing else is recalculated: every other session keeps its frozen minutes. */
export function deleteSession(year: TrackingYear, id: string): TrackingYear {
  return { ...year, sessions: year.sessions.filter((s) => s.id !== id) }
}

/**
 * Rename a task for one day: every session and typed adjustment of that day whose label matches `from`. Renaming
 * to the name of another task that day merges the two rows. Reported minutes are frozen and untouched, so nothing
 * is recalculated and the carry does not move. The new name may not be empty.
 */
export function renameTask(year: TrackingYear, date: string, from: string, to: string): Change {
  const name = to.trim()
  if (!name) return { ok: false, reason: 'empty-label' }
  if (!inYear(date, year.start)) return { ok: false, reason: 'outside-year' }
  const hit = (d: string, label: string): boolean => d === date && sameLabel(label, from)
  return {
    ok: true,
    year: {
      ...year,
      sessions: year.sessions.map((s) => (hit(s.date, s.label) ? { ...s, label: name } : s)),
      adjusts: year.adjusts.map((a) => (hit(a.date, a.label) ? { ...a, label: name } : a))
    }
  }
}
