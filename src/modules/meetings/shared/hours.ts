import { inAcademicYear } from '@shared/academic-year'
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

/** The meetings dated within an academic year (start year), upcoming ones included. */
export function meetingsInYear(rows: readonly MeetingIndexRow[], year: number): MeetingIndexRow[] {
  return rows.filter((r) => inAcademicYear(r.date, year))
}

/** What the list shows for an academic year: its meetings, plus every planned meeting with no date yet. */
export function meetingsInYearOrPlanned(
  rows: readonly MeetingIndexRow[],
  year: number
): MeetingIndexRow[] {
  return rows.filter((r) => r.date === '' || inAcademicYear(r.date, year))
}

/**
 * Hours for one academic year, from the start and end times. Upcoming meetings are left out (they have
 * not happened), and a meeting without both times counts as zero and is reported.
 */
export function meetingHours(
  rows: readonly MeetingIndexRow[],
  year: number,
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
