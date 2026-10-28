import { YEAR_WEEKS, inYear } from '@shared/year'
import { minutesPerSkill } from '@shared/skills'
import { fold } from '@shared/text'
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

/**
 * Contracts overlap, and a meeting has no contract of its own: its task's list is a client, and a client belongs to one contract.
 * Of the meetings in a contract's days, drops those whose task's list is a client the contract does not have. A meeting with no
 * task, or whose task is not known, stays: nothing is guessed. `listOf` gives a task's top-level list ('' when unknown).
 */
export function ofContractClients(
  rows: readonly MeetingIndexRow[],
  clients: readonly string[] | undefined,
  listOf: (taskUid: string) => string
): MeetingIndexRow[] {
  if (clients === undefined) return [...rows]
  const mine = new Set(clients.map(fold))
  return rows.filter((r) => {
    const list = r.task ? listOf(r.task) : ''
    return list === '' || mine.has(fold(list))
  })
}
