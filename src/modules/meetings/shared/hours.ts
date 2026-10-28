import { YEAR_WEEKS, inYear } from '@shared/year'
import { minutesPerSkill } from '@shared/skills'
import { isUpcoming } from './query'
import { durationMinutes } from './time'
import type { MeetingIndexRow } from './types'

/** Whether a date is in the period: the year (or contract) from its first day for `weeks`, and not after a contract's real `end`. */
function inPeriod(date: string, year: string, weeks: number, end?: string): boolean {
  return inYear(date, year, weeks) && (end === undefined || date <= end)
}

export interface MeetingHours {
  /** Meetings counted: in the year, not upcoming, and with some time. */
  meetings: number
  minutes: number
  perSkill: { skill: string; minutes: number }[]
}

/**
 * The meetings dated within a year (its start date), upcoming ones included. Work's period is a contract, which has its own
 * length in `weeks`.
 */
export function meetingsInYear(
  rows: readonly MeetingIndexRow[],
  year: string,
  weeks = YEAR_WEEKS,
  end?: string
): MeetingIndexRow[] {
  return rows.filter((r) => inPeriod(r.date, year, weeks, end))
}

/**
 * What the list shows for a year: its meetings, plus, in the current year only, every
 * planned meeting with no date yet (an earlier year must not show this year's plans).
 */
export function meetingsInYearOrPlanned(
  rows: readonly MeetingIndexRow[],
  year: string,
  today: string,
  weeks = YEAR_WEEKS,
  end?: string
): MeetingIndexRow[] {
  const showPlanned = inPeriod(today, year, weeks, end)
  return rows.filter((r) => (r.date === '' ? showPlanned : inPeriod(r.date, year, weeks, end)))
}

/**
 * Hours for one year, from the start and end times. Upcoming meetings are left out (they have
 * not happened), and so is a meeting with no time: it is kept, but not counted as done.
 */
export function meetingHours(
  rows: readonly MeetingIndexRow[],
  year: string,
  today: string,
  weeks = YEAR_WEEKS,
  end?: string,
  now?: string
): MeetingHours {
  const timed = meetingsInYear(rows, year, weeks, end)
    .filter((r) => !isUpcoming(r, today, now))
    .map((r) => ({ skills: r.skills, minutes: durationMinutes(r.start, r.end) }))
    .filter((t) => t.minutes)
  return {
    meetings: timed.length,
    minutes: timed.reduce((n, t) => n + (t.minutes ?? 0), 0),
    perSkill: minutesPerSkill(timed)
  }
}
