import { addDays, inYear, weeksOf } from '../year'
import { provisionalMinutes, QUARTER, reportedMinutes, timeToSeconds } from './rounding'
import { resolveClient, sameTask } from './timer'
import type { Adjust, Change, Moment, Session, TrackingYear } from './types'

export interface TaskRow {
  /** The first spelling used that day. */
  label: string
  /** The client the row is for (Work); a task is a label and a client. */
  client?: string
  /** The task (`cc://task/<uid>`) its time carries, when any of it does; older label-only time has none. */
  task?: string
  minutes: number
  running: boolean
  sessionIds: string[]
  /** Whether Delete would remove anything: some ended session or typed time that is not history linked to a task (`earlier`). */
  removable: boolean
}

/** What the running session would report now: only counted when `now` is given and it is on that day. */
function runningMinutes(s: Session, now: Moment | undefined): number {
  return now && s.date === now.date ? provisionalMinutes(s, now.time) : 0
}

/**
 * One row per task for a day, in the order first used (so rows do not jump while switching). A task's time is
 * its sessions' reported time plus its typed adjustments; a running session adds what it would report now. A
 * row at 0:00 that is not running is left out.
 */
export function dayRows(year: TrackingYear, date: string, now?: Moment): TaskRow[] {
  if (!inYear(date, year.start, year.weeks)) return []
  const rows: TaskRow[] = []
  const find = (label: string, client: string | undefined): TaskRow => {
    let row = rows.find((r) => sameTask(r, label, client))
    if (!row) {
      row = {
        label: label.trim(),
        ...(client !== undefined ? { client } : {}),
        minutes: 0,
        running: false,
        sessionIds: [],
        removable: false
      }
      rows.push(row)
    }
    return row
  }
  const sessions = year.sessions
    .filter((s) => s.date === date && !s.derived)
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (timeToSeconds(a.s.start) ?? 0) - (timeToSeconds(b.s.start) ?? 0) || a.i - b.i)
  for (const { s } of sessions) {
    const row = find(s.label, s.client)
    if (s.task && !row.task) row.task = s.task
    row.sessionIds.push(s.id)
    if (s.end === null) {
      row.running = true
      row.minutes += runningMinutes(s, now)
    } else {
      row.minutes += reportedMinutes(s)
      if (!s.earlier) row.removable = true
    }
  }
  for (const a of year.adjusts) {
    if (a.date !== date) continue
    const row = find(a.label, a.client)
    if (a.task && !row.task) row.task = a.task
    row.minutes += a.minutes
    if (!a.earlier) row.removable = true
  }
  return rows.filter((r) => r.minutes !== 0 || r.running)
}

/** Reported minutes for every date that has any, inside the year. */
export function minutesByDate(year: TrackingYear, now?: Moment): Map<string, number> {
  const map = new Map<string, number>()
  const add = (date: string, minutes: number): void => {
    if (minutes !== 0 && inYear(date, year.start, year.weeks))
      map.set(date, (map.get(date) ?? 0) + minutes)
  }
  for (const s of year.sessions)
    add(s.date, s.end === null ? runningMinutes(s, now) : reportedMinutes(s))
  for (const a of year.adjusts) add(a.date, a.minutes)
  for (const [date, d] of Object.entries(year.days)) add(date, d.minutes ?? 0)
  return map
}

/**
 * Reported minutes per client between two days (inclusive), in the plan's order, then any other name an entry carries,
 * then time with no client (older entries, and an imported day's typed total) last. Only clients with time are listed.
 */
export function minutesByClient(
  year: TrackingYear,
  from: string,
  to: string,
  now?: Moment
): { client: string | null; minutes: number }[] {
  const sums = new Map<string | null, number>()
  const add = (date: string, client: string | undefined, minutes: number): void => {
    if (minutes === 0 || date < from || date > to || !inYear(date, year.start, year.weeks)) return
    sums.set(client ?? null, (sums.get(client ?? null) ?? 0) + minutes)
  }
  for (const s of year.sessions)
    add(s.date, s.client, s.end === null ? runningMinutes(s, now) : reportedMinutes(s))
  for (const a of year.adjusts) add(a.date, a.client, a.minutes)
  for (const [date, d] of Object.entries(year.days)) add(date, undefined, d.minutes ?? 0)
  const order = year.plan.clients ?? []
  const rank = (client: string | null): number =>
    client === null
      ? order.length + 1
      : order.includes(client)
        ? order.indexOf(client)
        : order.length
  return [...sums]
    .map(([client, minutes]) => ({ client, minutes }))
    .sort(
      (a, b) => rank(a.client) - rank(b.client) || (a.client ?? '').localeCompare(b.client ?? '')
    )
}

export function dayMinutes(year: TrackingYear, date: string, now?: Moment): number {
  return minutesByDate(year, now).get(date) ?? 0
}

/** Seven days from `weekStart`, each with its minutes. */
export function weekDaysMinutes(
  year: TrackingYear,
  weekStart: string,
  now?: Moment
): { date: string; minutes: number }[] {
  const map = minutesByDate(year, now)
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i)
    return { date, minutes: map.get(date) ?? 0 }
  })
}

export function weekMinutes(year: TrackingYear, weekStart: string, now?: Moment): number {
  return weekDaysMinutes(year, weekStart, now).reduce((sum, d) => sum + d.minutes, 0)
}

/** Every week of the year with its hours. */
export function weeklyMinutes(
  year: TrackingYear,
  now?: Moment
): { number: number; from: string; to: string; minutes: number }[] {
  const map = minutesByDate(year, now)
  return weeksOf(year.start, year.weeks).map((w) => {
    let minutes = 0
    for (let i = 0; i < 7; i++) minutes += map.get(addDays(w.from, i)) ?? 0
    return { ...w, minutes }
  })
}

/** The year's reported minutes up to and including `through` (the whole year when omitted). */
export function yearMinutes(year: TrackingYear, through?: string, now?: Moment): number {
  let sum = 0
  for (const [date, minutes] of minutesByDate(year, now))
    if (!through || date <= through) sum += minutes
  return sum
}

function validQuarter(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes % QUARTER === 0
}

/**
 * Set a task's time for a day to exactly what was typed. It is saved as one adjustment equal to the difference
 * from the timer's time, so the row shows what was typed and later timer time adds on top. Nothing else moves:
 * no other session, task or day is recalculated, and the rounding carry is not touched. `client` is the row's own, as
 * shown: a row with none (older time) stays without.
 */
export function setTaskMinutes(
  year: TrackingYear,
  date: string,
  label: string,
  minutes: number,
  id: string,
  client?: string
): Change {
  const name = label.trim()
  if (!name) return { ok: false, reason: 'empty-label' }
  if (!inYear(date, year.start, year.weeks)) return { ok: false, reason: 'outside-year' }
  if (minutes < 0 || !validQuarter(minutes)) return { ok: false, reason: 'not-a-quarter' }
  let timer = 0
  for (const s of year.sessions)
    if (s.date === date && s.end !== null && sameTask(s, name, client)) timer += reportedMinutes(s)
  const same = (a: Adjust): boolean => a.date === date && sameTask(a, name, client)
  // History linked to a task (`earlier`) is never replaced: the typed total includes it, and the new adjustment is the rest.
  for (const a of year.adjusts) if (same(a) && a.earlier) timer += a.minutes
  const match = (a: Adjust): boolean => same(a) && !a.earlier
  // The new adjustment takes the place of the first it replaces, so a row does not move when its time is retyped.
  const first = year.adjusts.findIndex(match)
  const others = year.adjusts.filter((a) => !match(a))
  // Time retyped for a task that Tasks knows stays that task's: the link of the row's typed or timer time.
  const task =
    year.adjusts.find((a) => same(a) && a.task)?.task ??
    year.sessions.find((s) => s.date === date && sameTask(s, name, client) && s.task)?.task
  const entry: Adjust = {
    id,
    date,
    label: name,
    minutes: minutes - timer,
    ...(client !== undefined ? { client } : {}),
    ...(task ? { task } : {})
  }
  const adjusts: Adjust[] =
    minutes === timer
      ? others
      : first < 0
        ? [...others, entry]
        : [...others.slice(0, first), entry, ...others.slice(first)]
  return { ok: true, year: { ...year, adjusts } }
}

/**
 * Delete a task's saved time for a day: its ended sessions and its typed time. A running session is never touched (Discard
 * is for that), nor is a derived block (a meeting or lecture, edited in its note), and history linked to a task (`earlier`) is kept, since the task's ClickUp time holds it. Nothing is recalculated:
 * every other session keeps its frozen minutes, so the carry does not move. `client` is the row's own, as shown.
 */
export function deleteTaskTime(
  year: TrackingYear,
  date: string,
  label: string,
  client?: string
): TrackingYear {
  const gone = (e: { date: string; label: string; client?: string; earlier?: true }): boolean =>
    e.date === date && !e.earlier && sameTask(e, label, client)
  return {
    ...year,
    sessions: year.sessions.filter((s) => s.derived || s.end === null || !gone(s)),
    adjusts: year.adjusts.filter((a) => !gone(a))
  }
}

/** Add time that was not tracked, for any task and any day (positive, in quarter hours). */
export function addTime(
  year: TrackingYear,
  date: string,
  label: string,
  minutes: number,
  id: string,
  client?: string,
  task?: string
): Change {
  const name = label.trim()
  if (!name) return { ok: false, reason: 'empty-label' }
  if (!inYear(date, year.start, year.weeks)) return { ok: false, reason: 'outside-year' }
  if (minutes <= 0 || !validQuarter(minutes)) return { ok: false, reason: 'not-a-quarter' }
  const chosen = resolveClient(year, client)
  if (!chosen.ok) return chosen
  const adjust: Adjust = {
    id,
    date,
    label: name,
    minutes,
    ...(chosen.client !== undefined ? { client: chosen.client } : {}),
    ...(task ? { task } : {})
  }
  return { ok: true, year: { ...year, adjusts: [...year.adjusts, adjust] } }
}

/** A day's short note. An empty one removes it; a day left with nothing is dropped. */
export function setDayNote(year: TrackingYear, date: string, note: string): Change {
  if (!inYear(date, year.start, year.weeks)) return { ok: false, reason: 'outside-year' }
  const days = { ...year.days }
  const text = note.trim()
  const entry = { ...days[date] }
  if (text) entry.note = text
  else delete entry.note
  if (entry.minutes === undefined && entry.note === undefined) delete days[date]
  else days[date] = entry
  return { ok: true, year: { ...year, days } }
}
