import { inYear } from '@shared/year'
import { minutesPerSkill } from '@shared/skills'
import { isUpcoming } from './query'
import { durationMinutes } from './time'
import type { MeetingIndexRow } from './types'

export interface MeetingHours {
  /** Meetings counted: in the year and not upcoming. */
  meetings: number
  minutes: number
  /** Counted meetings with no usable start and end, which add nothing. */
  withoutTimes: number
  perSkill: { skill: string; minutes: number }[]
}

/** The meetings dated within a year (its start date), upcoming ones included. */
export function meetingsInYear(rows: readonly MeetingIndexRow[], year: string): MeetingIndexRow[] {
  return rows.filter((r) => inYear(r.date, year))
}

/**
 * What the list shows for a year: its meetings, plus, in the current year only, every
 * planned meeting with no date yet (an earlier year must not show this year's plans).
 */
export function meetingsInYearOrPlanned(
  rows: readonly MeetingIndexRow[],
  year: string,
  today: string
): MeetingIndexRow[] {
  const showPlanned = inYear(today, year)
  return rows.filter((r) => (r.date === '' ? showPlanned : inYear(r.date, year)))
}

/**
 * Hours for one year, from the start and end times. Upcoming meetings are left out (they have
 * not happened), and a meeting without both times counts as zero and is reported.
 */
export function meetingHours(
  rows: readonly MeetingIndexRow[],
  year: string,
  today: string
): MeetingHours {
  const counted = meetingsInYear(rows, year).filter((r) => !isUpcoming(r, today))
  const timed = counted.map((r) => ({
    skills: r.skills,
    minutes: durationMinutes(r.start, r.end)
  }))
  return {
    meetings: counted.length,
    minutes: timed.reduce((n, t) => n + (t.minutes ?? 0), 0),
    withoutTimes: timed.filter((t) => t.minutes === null).length,
    perSkill: minutesPerSkill(timed)
  }
}
