import { fold } from '../text'
import { inYear } from '../year'
import { reportedMinutes } from './rounding'
import type { DerivedKind, Session, TrackingYear } from './types'

/** Time that is not tracked here but worked out from somewhere else (a meeting or training note's date, start and end). */
export interface DerivedEntry {
  /** Where it comes from; a meeting when left out. */
  kind?: DerivedKind
  /** The note (its file's base name); with the kind it is what a row links to. */
  id: string
  date: string
  /** HH:MM */
  start: string
  end: string
  /** The task's key and title. */
  task: string
  label: string
  /** Work: the client the time is for. */
  client?: string
}

/**
 * The year as it is shown: the same year with the derived entries added as ended sessions marked `derived`. A copy, in memory: nothing
 * is written, so deleting the note takes its hours with it. An entry lands in the year that holds its date (and, in Work, whose
 * plan has its client; one with no client cannot be placed in Work). A derived block carries no reported minutes of its own, so it
 * is rounded to the quarter on its own and never touches the rounding carry of the real sessions.
 */
export function withDerived(year: TrackingYear, entries: readonly DerivedEntry[]): TrackingYear {
  const clients = year.plan.clients ?? []
  const added: Session[] = []
  for (const e of entries) {
    if (!inYear(e.date, year.start, year.weeks)) continue
    let client: string | undefined
    if (clients.length > 0) {
      client = clients.find((c) => fold(c) === fold(e.client ?? ''))
      if (client === undefined) continue
    }
    const kind = e.kind ?? 'meeting'
    added.push({
      id: `${kind}:${e.id}`,
      date: e.date,
      start: `${e.start}:00`,
      end: `${e.end}:00`,
      label: e.label,
      task: e.task,
      ...(client !== undefined ? { client } : {}),
      derived: { kind, id: e.id }
    })
  }
  return added.length === 0 ? year : { ...year, sessions: [...year.sessions, ...added] }
}

/** One read-only line of a day: a meeting or a lecture, with the minutes it reports. */
export interface DerivedRow {
  kind: DerivedKind
  /** The note. */
  id: string
  label: string
  client?: string
  task?: string
  start: string
  end: string
  minutes: number
}

/** A day's derived lines, earliest first. Their minutes are the same ones the totals count. */
export function derivedRows(year: TrackingYear, date: string): DerivedRow[] {
  return year.sessions
    .filter((s) => s.date === date && s.derived && s.end !== null)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((s) => ({
      kind: s.derived?.kind ?? 'meeting',
      id: s.derived?.id ?? '',
      label: s.label,
      ...(s.client !== undefined ? { client: s.client } : {}),
      ...(s.task ? { task: s.task } : {}),
      start: s.start.slice(0, 5),
      end: (s.end as string).slice(0, 5),
      minutes: reportedMinutes(s)
    }))
}
