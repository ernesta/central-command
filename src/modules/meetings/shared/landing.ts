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

/** One summary per series: the fixed series first (even with no meetings), then any other series in the files. */
export function seriesSummaries(rows: readonly MeetingIndexRow[], today: string): SeriesSummary[] {
  const names = [...SERIES] as string[]
  for (const r of rows) if (r.series && !names.includes(r.series)) names.push(r.series)
  return names.map((series) => {
    const mine = rows.filter((r) => r.series === series && r.date !== '')
    const happened = mine.filter((r) => !isUpcoming(r, today)).map((r) => r.date)
    const upcoming = mine.filter((r) => isUpcoming(r, today)).map((r) => r.date)
    return {
      series,
      count: rows.filter((r) => r.series === series && !isUpcoming(r, today)).length,
      last: happened.length ? happened.reduce((a, b) => (a > b ? a : b)) : null,
      next: upcoming.length ? upcoming.reduce((a, b) => (a < b ? a : b)) : null
    }
  })
}

/** "9 meetings · last Sep 12 · next Oct 1", "1 meeting · last Jun 23", or "No meetings yet". */
export function seriesLine(summary: SeriesSummary, formatDate: (date: string) => string): string {
  const { count, last, next } = summary
  const parts = [`${count} ${count === 1 ? 'meeting' : 'meetings'}`]
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

/** For the landing page: the next few upcoming meetings and the latest few that have happened. */
export function recentAndUpcoming(
  rows: readonly MeetingIndexRow[],
  today: string,
  limits = { upcoming: 3, recent: 5 }
): RecentAndUpcoming {
  return {
    upcoming: upcomingMeetings(rows, today).slice(0, limits.upcoming),
    recent: rows
      .filter((r) => !isUpcoming(r, today))
      .sort(compareNewestFirst)
      .slice(0, limits.recent)
  }
}
