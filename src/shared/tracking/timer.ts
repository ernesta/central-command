import { inYear } from '../year'
import { carrySeconds, exactSeconds, reportFor, timeToSeconds } from './rounding'
import type { Change, Moment, Session, TrackingYear } from './types'

/** Two task names are the same task when they match after trimming and ignoring case. */
export function sameLabel(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** Two entries are for the same client when both name it alike or both name none (exact: the plan's list spells it). */
export function sameClient(a: string | undefined, b: string | undefined): boolean {
  return (a ?? '') === (b ?? '')
}

/** A task is a label and a client: the same label for another client is another task. */
export function sameTask(
  a: { label: string; client?: string },
  label: string,
  client: string | undefined
): boolean {
  return sameLabel(a.label, label) && sameClient(a.client, client)
}

/**
 * The client a new entry gets when none is chosen: the one of the latest entry (so work carries on for the same client),
 * else the plan's first. Undefined where the plan has no clients.
 */
export function defaultClient(year: TrackingYear): string | undefined {
  const clients = year.plan.clients ?? []
  if (clients.length === 0) return undefined
  const used = [
    ...year.sessions.map((s) => ({ client: s.client, at: `${s.date} ${s.start}` })),
    ...year.adjusts.map((a) => ({ client: a.client, at: `${a.date} 99:99:99` }))
  ]
    .filter((e) => e.client !== undefined && clients.includes(e.client))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  return used[0]?.client ?? clients[0]
}

/**
 * The client to record: none where the plan has none (whatever was asked), the default when none is asked for, and
 * a refusal for a name not on the plan's list.
 */
export function resolveClient(
  year: TrackingYear,
  client: string | undefined
): { ok: true; client: string | undefined } | { ok: false; reason: string } {
  const clients = year.plan.clients ?? []
  if (clients.length === 0) return { ok: true, client: undefined }
  if (client === undefined) return { ok: true, client: defaultClient(year) }
  return clients.includes(client) ? { ok: true, client } : { ok: false, reason: 'bad-client' }
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
  task?: string,
  client?: string
): Change {
  const name = label.trim()
  const chosen = resolveClient(year, client)
  if (!chosen.ok) return chosen
  if (!inYear(now.date, year.start, year.weeks)) return { ok: false, reason: 'outside-year' }
  if (timeToSeconds(now.time) === null) return { ok: false, reason: 'bad-time' }
  let current = year
  const running = runningSession(year)
  if (running) {
    if (running.date !== now.date) return { ok: false, reason: 'stale' }
    if (sameTask(running, name, chosen.client)) return { ok: true, year }
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
    ...(task ? { task } : {}),
    ...(chosen.client !== undefined ? { client: chosen.client } : {})
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

/** When a day ends, as a timer time: the last second before 04:00 the next morning. Matches `DAY_END_HOUR` in `shared/time.ts`. */
export const DAY_END_TIME = '27:59:59'

/**
 * End the running session at the end of its day when that day is over (`now` is on a later day), so nothing runs on
 * past the day end. It keeps its start and gets `DAY_END_TIME`, reporting against the carry like any other stop.
 */
export function endFinishedDay(year: TrackingYear, now: Moment): Change {
  const running = runningSession(year)
  if (!running || running.date >= now.date) return { ok: true, year }
  return close(year, running, DAY_END_TIME)
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
export function renameTask(
  year: TrackingYear,
  date: string,
  from: string,
  to: string,
  client?: string
): Change {
  const name = to.trim()
  if (!name) return { ok: false, reason: 'empty-label' }
  if (!inYear(date, year.start, year.weeks)) return { ok: false, reason: 'outside-year' }
  const hit = (e: { date: string; label: string; client?: string }): boolean =>
    e.date === date && sameTask(e, from, client)
  return {
    ok: true,
    year: {
      ...year,
      sessions: year.sessions.map((s) => (hit(s) ? { ...s, label: name } : s)),
      adjusts: year.adjusts.map((a) => (hit(a) ? { ...a, label: name } : a))
    }
  }
}

/**
 * Change the client of a task for one day: every session and typed adjustment of that day with that label and client
 * (`from`). Reported minutes are frozen and untouched. The new client must be on the plan's list.
 */
export function setClient(
  year: TrackingYear,
  date: string,
  label: string,
  from: string | undefined,
  to: string
): Change {
  if (!inYear(date, year.start, year.weeks)) return { ok: false, reason: 'outside-year' }
  if (!(year.plan.clients ?? []).includes(to)) return { ok: false, reason: 'bad-client' }
  const hit = (e: { date: string; label: string; client?: string }): boolean =>
    e.date === date && sameTask(e, label, from)
  return {
    ok: true,
    year: {
      ...year,
      sessions: year.sessions.map((s) => (hit(s) ? { ...s, client: to } : s)),
      adjusts: year.adjusts.map((a) => (hit(a) ? { ...a, client: to } : a))
    }
  }
}
