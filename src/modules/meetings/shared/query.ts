import { fold } from '@shared/text'
import { deriveInitials, findByName } from './people'
import { formatDate } from './time'
import { SERIES, type MeetingIndexRow, type MeetingMode, type Person } from './types'

export interface MeetingsQuery {
  search: string
  /** A series name, or 'all'. */
  series: string
  /** An attendee's full name, or 'all'. */
  attendee: string
  mode: MeetingMode | 'all'
}

export const DEFAULT_MEETINGS_QUERY: MeetingsQuery = {
  search: '',
  series: 'all',
  attendee: 'all',
  mode: 'all'
}

export const MODE_LABELS: Record<MeetingMode, string> = {
  'in-person': 'In person',
  online: 'Online'
}

/** Initials to show for an attendee: from the people list, else worked out from the name. */
export function initialsFor(name: string, people: readonly Person[]): string {
  return findByName(people, name)?.initials ?? (deriveInitials(name) || name)
}

/** A meeting after `today` (YYYY-MM-DD). Meetings with no date are never upcoming. */
export function isUpcoming(row: Pick<MeetingIndexRow, 'date'>, today: string): boolean {
  return row.date > today // '' (no date) sorts before every date, so it is never upcoming
}

/** Newest first: by date, then start time (no start time last), then id. Meetings with no date come last. */
export function compareNewestFirst(a: MeetingIndexRow, b: MeetingIndexRow): number {
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

function haystack(row: MeetingIndexRow, people: readonly Person[]): string {
  return fold(
    [
      row.date,
      row.date ? formatDate(row.date) : '',
      row.series,
      row.mode ? MODE_LABELS[row.mode] : '',
      row.attendees.join(' '),
      row.attendees.map((a) => initialsFor(a, people)).join(' '),
      row.summary,
      row.excerpt
    ].join('\n')
  )
}

/**
 * The meetings for the list, filtered and put newest first. Upcoming meetings are included (the list
 * marks them); the supervision log export, built later, will leave them out. Meetings whose date could
 * not be read are kept, at the end, so a file with a problem is never hidden. Pure, like the Readings query.
 */
export function queryMeetings(
  rows: readonly MeetingIndexRow[],
  query: MeetingsQuery,
  people: readonly Person[]
): MeetingIndexRow[] {
  const terms = fold(query.search).split(/\s+/).filter(Boolean)
  return rows
    .filter((r) => query.series === 'all' || r.series === query.series)
    .filter((r) => query.mode === 'all' || r.mode === query.mode)
    .filter((r) => query.attendee === 'all' || r.attendees.includes(query.attendee))
    .filter((r) => {
      if (terms.length === 0) return true
      const text = haystack(r, people)
      return terms.every((t) => text.includes(t))
    })
    .sort(compareNewestFirst)
}

/** The upcoming meetings, soonest first. */
export function upcomingMeetings(
  rows: readonly MeetingIndexRow[],
  today: string
): MeetingIndexRow[] {
  return rows.filter((r) => isUpcoming(r, today)).sort((a, b) => -compareNewestFirst(a, b))
}

/** Series to offer in the filter: the fixed list, then any other series found in the files. */
export function seriesOptions(rows: readonly MeetingIndexRow[]): string[] {
  const extra = [
    ...new Set(
      rows.map((r) => r.series).filter((s) => s && !(SERIES as readonly string[]).includes(s))
    )
  ]
  return [...SERIES, ...extra.sort()]
}

/** Everyone who appears as an attendee in these meetings, by name. */
export function attendeeNames(rows: readonly MeetingIndexRow[]): string[] {
  return [...new Set(rows.flatMap((r) => r.attendees))].sort((a, b) => a.localeCompare(b))
}

/** "14:00–15:00", "14:00" or "—". */
export function formatTimeRange(start: string | null, end: string | null): string {
  if (start && end) return `${start}–${end}`
  return start ?? '—'
}
