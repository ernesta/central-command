import { academicYearLabel, inAcademicYear } from '@shared/academic-year'
import { fold } from '@shared/text'
import { formatDate, durationMinutes } from '@shared/time'
import { formatHours, minutesPerSkill } from '@shared/skills'
import { findByName } from '@modules/meetings/shared/people'
import type { Person } from '@modules/meetings/shared/types'
import { TRAINING_MODE_LABELS, type TrainingIndexRow, type TrainingMode } from './types'

/** An entry after `today` (YYYY-MM-DD). Entries with no date are never upcoming. */
export function isUpcoming(row: Pick<TrainingIndexRow, 'date'>, today: string): boolean {
  return row.date > today // '' (no date) sorts before every date
}

/** The entries dated within an academic year (start year), upcoming ones included. */
export function entriesInYear(rows: readonly TrainingIndexRow[], year: number): TrainingIndexRow[] {
  return rows.filter((r) => inAcademicYear(r.date, year))
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
 * Hours for one academic year, from the start and end times. Upcoming entries are left out (they have
 * not happened), and an entry without both times counts as zero and is reported.
 */
export function trainingHours(
  rows: readonly TrainingIndexRow[],
  year: number,
  today: string,
  aimHours: number
): TrainingHours {
  const counted = entriesInYear(rows, year).filter((r) => !isUpcoming(r, today))
  const timed = counted.map((r) => ({
    skills: r.skills,
    minutes: durationMinutes(r.start, r.end)
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

/** Newest first: by date, then start time (no start time last), then id. Entries with no date come last. */
export function compareNewestFirst(a: TrainingIndexRow, b: TrainingIndexRow): number {
  if (a.date !== b.date) {
    if (a.date === '') return 1
    if (b.date === '') return -1
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

/** Series to offer in the filter and the chooser: the start list, then any other series found in the files. */
export function seriesOptions(
  rows: readonly TrainingIndexRow[],
  start: readonly string[]
): string[] {
  const extra = [
    ...new Set(rows.map((r) => r.series).filter((s): s is string => !!s && !start.includes(s)))
  ]
  return [...start, ...extra.sort((a, b) => a.localeCompare(b))]
}

/** Everyone who appears as a lead in these entries, by name. */
export function leadNames(rows: readonly TrainingIndexRow[]): string[] {
  return [...new Set(rows.flatMap((r) => r.leads))].sort((a, b) => a.localeCompare(b))
}

/** The skills used in these entries, by name. */
export function skillNames(rows: readonly TrainingIndexRow[]): string[] {
  return [...new Set(rows.flatMap((r) => r.skills))].sort((a, b) => a.localeCompare(b))
}

export function yearHoursTitle(year: number): string {
  return `Hours of training, ${academicYearLabel(year)}`
}

/** "plus 36.5 h of meetings, which Inkpath also counts" for the line under the Training total. */
export function meetingsLine(meetingMinutes: number): string {
  return `plus ${formatHours(meetingMinutes)} of meetings, which Inkpath also counts`
}
