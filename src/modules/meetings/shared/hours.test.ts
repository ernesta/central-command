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

  it('counts a meeting without times as zero and says how many there are', () => {
    const hours = meetingHours(
      [row('2026-01-01', { start: null, end: null }), row('2026-01-02', { end: '09:00' })],
      '2025-09-22',
      TODAY
    )
    expect(hours.minutes).toBe(0)
    expect(hours.withoutTimes).toBe(2)
    expect(hours.meetings).toBe(2)
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
