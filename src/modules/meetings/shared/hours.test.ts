import { describe, expect, it } from 'vitest'
import { meetingHours, meetingsInYear, meetingsInYearOrPlanned } from './hours'
import type { MeetingIndexRow } from './types'

const row = (date: string, over: Partial<MeetingIndexRow> = {}): MeetingIndexRow => ({
  workspace: 'research',
  id: `${date} Supervision`,
  uid: '',
  task: '',
  series: 'Supervision',
  date,
  start: '10:00',
  end: '11:00',
  mode: null,
  attendees: [],
  skills: [],
  summary: '',
  excerpt: '',
  problems: [],
  topicCount: 0,
  hasNotes: false,
  todos: [],
  contentHash: 'h',
  ...over
})

const TODAY = '2026-03-01'

describe('meetingHours', () => {
  it('adds up the minutes from the times, within the year only', () => {
    const rows = [
      row('2025-09-22'),
      row('2026-02-10', { start: '09:00', end: '09:45' }),
      row('2025-09-21'),
      row('2026-09-21')
    ]
    expect(meetingHours(rows, '2025-09-22', TODAY).minutes).toBe(105)
    expect(meetingsInYear(rows, '2025-09-22')).toHaveLength(2)
  })

  it('leaves out upcoming meetings', () => {
    const hours = meetingHours([row('2026-03-02'), row('2026-03-01')], '2025-09-22', TODAY)
    expect(hours.meetings).toBe(1)
    expect(hours.minutes).toBe(60)
  })

  it('leaves out a meeting without times, neither done nor mentioned', () => {
    const hours = meetingHours(
      [row('2026-01-01', { start: null, end: null }), row('2026-01-02', { end: '09:00' })],
      '2025-09-22',
      TODAY
    )
    expect(hours.minutes).toBe(0)
    expect(hours.meetings).toBe(0)
  })

  it('counts a meeting towards every one of its skills', () => {
    const hours = meetingHours(
      [
        row('2026-01-01', { skills: ['Networking (RP)', 'Leadership (RP)'] }),
        row('2026-01-02', { skills: ['Networking (RP)'] })
      ],
      '2025-09-22',
      TODAY
    )
    expect(hours.perSkill).toEqual([
      { skill: 'Networking (RP)', minutes: 120 },
      { skill: 'Leadership (RP)', minutes: 60 }
    ])
  })
})

describe('meetingsInYearOrPlanned', () => {
  const rows = [row('2025-10-01'), row('2026-10-01'), row('')]
  const today = '2026-09-30' // in 2026–27

  it('shows planned meetings in the current year only', () => {
    expect(meetingsInYearOrPlanned(rows, '2026-09-21', today)).toHaveLength(2)
    expect(meetingsInYearOrPlanned(rows, '2025-09-22', today).map((r) => r.date)).toEqual([
      '2025-10-01'
    ])
  })
})

describe('a Work contract as the period', () => {
  // A contract of 26 weeks from Fri 1 May 2026 ends Thu 29 Oct 2026; the 52-week year would run on to April 2027.
  const rows = [row('2026-05-01'), row('2026-10-29'), row('2026-10-30'), row('2026-04-30'), row('')]
  it('keeps the meetings between its first and last day', () => {
    expect(meetingsInYear(rows, '2026-05-01', 26).map((r) => r.date)).toEqual([
      '2026-05-01',
      '2026-10-29'
    ])
    expect(meetingsInYear(rows, '2026-05-01').map((r) => r.date)).toContain('2026-10-30')
  })
  it('shows the undated plans only while it holds today', () => {
    const planned = (today: string): number =>
      meetingsInYearOrPlanned(rows, '2026-05-01', today, 26).filter((r) => r.date === '').length
    expect(planned('2026-10-29')).toBe(1)
    expect(planned('2026-10-30')).toBe(0)
  })
  it('counts only its own meetings in the hours', () => {
    const timed = [
      row('2026-06-01', { start: '10:00', end: '11:00' }),
      row('2026-11-02', { start: '10:00', end: '11:00' })
    ]
    expect(meetingHours(timed, '2026-05-01', '2026-12-01', 26).minutes).toBe(60)
  })
})

describe("today's meeting and the clock", () => {
  const rows = [row(TODAY)] // 10:00–11:00
  const hours = (now: string): number =>
    meetingHours(rows, '2025-09-22', TODAY, undefined, undefined, now).minutes

  it('counts once it is over, not before or while it runs', () => {
    expect(hours('09:00')).toBe(0)
    expect(hours('10:30')).toBe(0)
    expect(hours('11:00')).toBe(60)
  })
})
