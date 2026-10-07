import { inYear, yearLabel } from '@shared/year'
import { fold } from '@shared/text'
import { formatDate, durationMinutes } from '@shared/time'
import { formatHours, minutesPerSkill } from '@shared/skills'
import { findByName } from '@shared/people'
import type { Person } from '@shared/people'
import { lectureTaskUid } from './lecture-entries'
import { TRAINING_MODE_LABELS, type TrainingIndexRow, type TrainingMode } from './types'

/** An entry that has not happened yet: after `today` (YYYY-MM-DD), or planned with no date yet. */
export function isUpcoming(row: Pick<TrainingIndexRow, 'date'>, today: string): boolean {
  return row.date === '' || row.date > today
}

/**
 * What the list shows for a year: its entries, plus, in the current year only, every
 * planned entry with no date yet (an earlier year must not show this year's plans).
 */
export function entriesInYearOrPlanned(
  rows: readonly TrainingIndexRow[],
  year: string,
  today: string
): TrainingIndexRow[] {
  const showPlanned = inYear(today, year)
  return rows.filter((r) => (r.date === '' ? showPlanned : inYear(r.date, year)))
}

/** The entries dated within a year (its start date), upcoming ones included. */
export function entriesInYear(rows: readonly TrainingIndexRow[], year: string): TrainingIndexRow[] {
  return rows.filter((r) => inYear(r.date, year))
}

/** Minutes tracked on each task (by uid) in Hours: a lecture's self-study timers and typed time. */
export type SelfStudy = ReadonlyMap<string, number>

/**
 * A lecture's hours as one total, with no split: the note's own session (its start and end) plus everything tracked on its
 * subtask. A note with no task has only its session, exactly as before. Null when there is neither (no times, no self-study).
 */
export function entryMinutes(
  row: Pick<TrainingIndexRow, 'start' | 'end' | 'task'>,
  selfStudy?: SelfStudy
): number | null {
  const session = durationMinutes(row.start, row.end)
  const uid = lectureTaskUid(row.task)
  const extra = uid ? (selfStudy?.get(uid) ?? 0) : 0
  return session === null && extra === 0 ? null : (session ?? 0) + extra
}

export interface TrainingHours {
  /** Entries counted: in the year and not upcoming. */
  entries: number
  minutes: number
  /** Counted entries with no usable start and end, which add nothing. */
  withoutTimes: number
  perSkill: { skill: string; minutes: number }[]
  /** Minutes done as a fraction of the aim; can pass 1. 0 when the aim is not positive. */
  progress: number
}

/**
 * Hours for one year, from the start and end times. Upcoming entries are left out (they have
 * not happened), and an entry without both times counts as zero and is reported.
 */
export function trainingHours(
  rows: readonly TrainingIndexRow[],
  year: string,
  today: string,
  aimHours: number,
  selfStudy?: SelfStudy
): TrainingHours {
  const counted = entriesInYear(rows, year).filter((r) => !isUpcoming(r, today))
  const timed = counted.map((r) => ({
    skills: r.skills,
    minutes: entryMinutes(r, selfStudy)
  }))
  const minutes = timed.reduce((n, t) => n + (t.minutes ?? 0), 0)
  return {
    entries: counted.length,
    minutes,
    withoutTimes: timed.filter((t) => t.minutes === null).length,
    perSkill: minutesPerSkill(timed),
    progress: aimHours > 0 ? minutes / (aimHours * 60) : 0
  }
}

export interface TrainingQuery {
  search: string
  /** A series name, or 'all'. */
  series: string
  /** A type name, or 'all'. */
  type: string
  /** A skill name, or 'all'. */
  skill: string
  /** A lead's full name, or 'all'. */
  lead: string
}

export const DEFAULT_TRAINING_QUERY: TrainingQuery = {
  search: '',
  series: 'all',
  type: 'all',
  skill: 'all',
  lead: 'all'
}

/** Turn whatever was remembered (possibly hand-edited, or from an older version) into a valid query. */
export function normaliseTrainingQuery(raw: unknown): TrainingQuery {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const text = (v: unknown): string => (typeof v === 'string' && v !== '' ? v : 'all')
  return {
    search: typeof o.search === 'string' ? o.search : '',
    series: text(o.series),
    type: text(o.type),
    skill: text(o.skill),
    lead: text(o.lead)
  }
}

export function trainingFiltersActive(query: TrainingQuery): boolean {
  return (
    query.search.trim() !== '' ||
    query.series !== 'all' ||
    query.type !== 'all' ||
    query.skill !== 'all' ||
    query.lead !== 'all'
  )
}

/** The remembered query with any series, type, skill or lead that is no longer in the files set back to "all". */
export function reconcileTrainingQuery(
  query: TrainingQuery,
  options: {
    series: readonly string[]
    types: readonly string[]
    skills: readonly string[]
    leads: readonly string[]
  }
): TrainingQuery {
  const keep = (value: string, list: readonly string[]): string =>
    value === 'all' || list.includes(value) ? value : 'all'
  return {
    ...query,
    series: keep(query.series, options.series),
    type: keep(query.type, options.types),
    skill: keep(query.skill, options.skills),
    lead: keep(query.lead, options.leads)
  }
}

/** Newest first: by date, then start time (no start time last), then id. Entries with no date (planned) come first. */
export function compareNewestFirst(a: TrainingIndexRow, b: TrainingIndexRow): number {
  if (a.date !== b.date) {
    if (a.date === '') return -1
    if (b.date === '') return 1
    return a.date < b.date ? 1 : -1
  }
  const sa = a.start ?? ''
  const sb = b.start ?? ''
  if (sa !== sb) return sa < sb ? 1 : -1
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
}

function haystack(row: TrainingIndexRow, people: readonly Person[]): string {
  return fold(
    [
      row.date,
      row.date ? formatDate(row.date) : '',
      row.title,
      row.series ?? '',
      row.type ?? '',
      row.mode ? TRAINING_MODE_LABELS[row.mode as TrainingMode] : '',
      row.skills.join(' '),
      row.leads.join(' '),
      row.leads.map((l) => findByName(people, l)?.initials ?? '').join(' '),
      row.institution ?? '',
      row.summary,
      row.excerpt
    ].join('\n')
  )
}

/**
 * The entries for the list, filtered. Upcoming entries are included (the list marks them); the PDF
 * export leaves them out. Sorted newest first; `oldestFirst` reverses it, as the log is read.
 */
export function queryTraining(
  rows: readonly TrainingIndexRow[],
  query: TrainingQuery,
  people: readonly Person[]
): TrainingIndexRow[] {
  const terms = fold(query.search).split(/\s+/).filter(Boolean)
  return rows
    .filter((r) => query.series === 'all' || r.series === query.series)
    .filter((r) => query.type === 'all' || r.type === query.type)
    .filter((r) => query.skill === 'all' || r.skills.includes(query.skill))
    .filter((r) => query.lead === 'all' || r.leads.includes(query.lead))
    .filter((r) => {
      if (terms.length === 0) return true
      const text = haystack(r, people)
      return terms.every((t) => text.includes(t))
    })
    .sort(compareNewestFirst)
}

/** Series to offer in the filter and the chooser: those found in the files, so a series with no entries does not exist. */
export function seriesOptions(rows: readonly TrainingIndexRow[]): string[] {
  const found = new Set(rows.map((r) => r.series).filter((s): s is string => !!s))
  return [...found].sort((a, b) => a.localeCompare(b))
}

/** Institutions used in the entries, sorted, for the drop-down (a new one can still be typed). */
export function institutionOptions(rows: readonly TrainingIndexRow[]): string[] {
  const found = new Set(rows.map((r) => r.institution).filter((s): s is string => !!s))
  return [...found].sort((a, b) => a.localeCompare(b))
}

/** Everyone who appears as a lead in these entries, by name. */
export function leadNames(rows: readonly TrainingIndexRow[]): string[] {
  return [...new Set(rows.flatMap((r) => r.leads))].sort((a, b) => a.localeCompare(b))
}

export function yearHoursTitle(year: string): string {
  return `Hours of training, ${yearLabel(year)}`
}

/** "plus 36.5 h of meetings, which Inkpath also counts" for the line under the Training total. */
export function meetingsLine(meetingMinutes: number): string {
  return `plus ${formatHours(meetingMinutes)} of meetings, which Inkpath also counts`
}

/** The next few upcoming entries (soonest first, planned ones with no date last) and the latest few that have happened. */
export function recentAndUpcoming(
  rows: readonly TrainingIndexRow[],
  today: string,
  limits = { upcoming: 3, recent: 5 }
): { upcoming: TrainingIndexRow[]; recent: TrainingIndexRow[] } {
  return {
    upcoming: rows
      .filter((r) => isUpcoming(r, today))
      .sort((a, b) => -compareNewestFirst(a, b))
      .slice(0, limits.upcoming),
    recent: rows
      .filter((r) => !isUpcoming(r, today))
      .sort(compareNewestFirst)
      .slice(0, limits.recent)
  }
}

export interface SeriesSummary {
  series: string
  /** Entries that have happened (upcoming ones are not counted). */
  count: number
  minutes: number
}

/** One summary per series that has entries among the rows given. */
export function seriesSummaries(
  rows: readonly TrainingIndexRow[],
  today: string,
  selfStudy?: SelfStudy
): SeriesSummary[] {
  return seriesOptions(rows).map((series) => {
    const mine = rows.filter((r) => r.series === series && !isUpcoming(r, today))
    return {
      series,
      count: mine.length,
      minutes: mine.reduce((n, r) => n + (entryMinutes(r, selfStudy) ?? 0), 0)
    }
  })
}
