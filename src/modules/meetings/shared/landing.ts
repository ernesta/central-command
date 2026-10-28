import { LANDING_DAYS, addDays } from '@shared/year'
import { compareNewestFirst, isUpcoming, upcomingMeetings } from './query'
import { SERIES, type MeetingIndexRow } from './types'

export interface SeriesSummary {
  series: string
  /** Meetings that have happened (upcoming ones are not counted). */
  count: number
  /** Date of the latest meeting that has happened, or null. */
  last: string | null
  /** Date of the soonest upcoming meeting, or null. */
  next: string | null
}

/**
 * One summary per series: `fixedSeries` first (even with no meetings — Research's own fixed list, `SERIES`,
 * so a category can be opened before its first meeting), then any other series actually found in the files.
 * A workspace with no fixed list of its own (Work's series are just its vault's folder names) should pass
 * `[]`, so it only ever shows a series that has at least one meeting.
 */
export function seriesSummaries(
  rows: readonly MeetingIndexRow[],
  today: string,
  fixedSeries: readonly string[] = SERIES,
  now?: string
): SeriesSummary[] {
  const names = [...fixedSeries]
  for (const r of rows) if (r.series && !names.includes(r.series)) names.push(r.series)
  return names.map((series) => {
    const mine = rows.filter((r) => r.series === series && r.date !== '')
    const happened = mine.filter((r) => !isUpcoming(r, today, now)).map((r) => r.date)
    const upcoming = mine.filter((r) => isUpcoming(r, today, now)).map((r) => r.date)
    return {
      series,
      count: rows.filter((r) => r.series === series && !isUpcoming(r, today, now)).length,
      last: happened.length ? happened.reduce((a, b) => (a > b ? a : b)) : null,
      next: upcoming.length ? upcoming.reduce((a, b) => (a < b ? a : b)) : null
    }
  })
}

/** "9 done · last Sep 12 · next Oct 1", "1 done · last Jun 23", or "No meetings yet". */
export function seriesLine(summary: SeriesSummary, formatDate: (date: string) => string): string {
  const { count, last, next } = summary
  const parts = count > 0 ? [`${count} done`] : []
  if (last) parts.push(`last ${formatDate(last)}`)
  if (next) parts.push(`next ${formatDate(next)}`)
  return count === 0 && !next ? 'No meetings yet' : parts.join(' · ')
}

export interface RecentAndUpcoming {
  /** Soonest first. */
  upcoming: MeetingIndexRow[]
  /** Newest first. */
  recent: MeetingIndexRow[]
}

/** For the landing page: the meetings of the next `LANDING_DAYS` days and of the last `LANDING_DAYS` days, today included. */
export function recentAndUpcoming(
  rows: readonly MeetingIndexRow[],
  today: string,
  now?: string
): RecentAndUpcoming {
  const from = addDays(today, -LANDING_DAYS)
  const to = addDays(today, LANDING_DAYS)
  return {
    upcoming: upcomingMeetings(rows, today, now).filter((r) => r.date === '' || r.date <= to),
    recent: rows
      .filter((r) => !isUpcoming(r, today, now) && r.date >= from)
      .sort(compareNewestFirst)
  }
}
