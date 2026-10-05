import { addDays, inYear, weeksOf } from '../year'
import { provisionalMinutes, QUARTER, reportedMinutes, timeToSeconds } from './rounding'
import { sameLabel } from './timer'
import type { Adjust, Change, Moment, Session, TrackingYear } from './types'

export interface TaskRow {
  /** The first spelling used that day. */
  label: string
  minutes: number
  running: boolean
  sessionIds: string[]
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
  const find = (label: string): TaskRow => {
    let row = rows.find((r) => sameLabel(r.label, label))
    if (!row) {
      row = { label: label.trim(), minutes: 0, running: false, sessionIds: [] }
      rows.push(row)
    }
    return row
  }
  const sessions = year.sessions
    .filter((s) => s.date === date)
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (timeToSeconds(a.s.start) ?? 0) - (timeToSeconds(b.s.start) ?? 0) || a.i - b.i)
  for (const { s } of sessions) {
    const row = find(s.label)
    row.sessionIds.push(s.id)
    if (s.end === null) {
      row.running = true
      row.minutes += runningMinutes(s, now)
    } else row.minutes += reportedMinutes(s)
  }
  for (const a of year.adjusts) if (a.date === date) find(a.label).minutes += a.minutes
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
 * no other session, task or day is recalculated, and the rounding carry is not touched.
 */
export function setTaskMinutes(
  year: TrackingYear,
  date: string,
  label: string,
  minutes: number,
  id: string
): Change {
  const name = label.trim()
  if (!name) return { ok: false, reason: 'empty-label' }
  if (!inYear(date, year.start, year.weeks)) return { ok: false, reason: 'outside-year' }
  if (minutes < 0 || !validQuarter(minutes)) return { ok: false, reason: 'not-a-quarter' }
  let timer = 0
  for (const s of year.sessions)
    if (s.date === date && s.end !== null && sameLabel(s.label, name)) timer += reportedMinutes(s)
  const others = year.adjusts.filter((a) => !(a.date === date && sameLabel(a.label, name)))
  const diff = minutes - timer
  const adjusts: Adjust[] =
    diff === 0 ? others : [...others, { id, date, label: name, minutes: diff }]
  return { ok: true, year: { ...year, adjusts } }
}

/** Add time that was not tracked, for any task and any day (positive, in quarter hours). */
export function addTime(
  year: TrackingYear,
  date: string,
  label: string,
  minutes: number,
  id: string
): Change {
  const name = label.trim()
  if (!name) return { ok: false, reason: 'empty-label' }
  if (!inYear(date, year.start, year.weeks)) return { ok: false, reason: 'outside-year' }
  if (minutes <= 0 || !validQuarter(minutes)) return { ok: false, reason: 'not-a-quarter' }
  return {
    ok: true,
    year: { ...year, adjusts: [...year.adjusts, { id, date, label: name, minutes }] }
  }
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
