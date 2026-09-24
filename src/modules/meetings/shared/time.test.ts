import { describe, expect, it } from 'vitest'
import { durationMinutes, formatDate, formatDuration, meetingHeading } from './time'

describe('durationMinutes', () => {
  it('is end minus start', () => {
    expect(durationMinutes('14:00', '15:00')).toBe(60)
    expect(durationMinutes('09:05', '10:50')).toBe(105)
    expect(durationMinutes('9:00', '9:15')).toBe(15)
  })
  it('is blank when either time is missing, invalid, or the end is not after the start', () => {
    expect(durationMinutes(null, '15:00')).toBeNull()
    expect(durationMinutes('14:00', null)).toBeNull()
    expect(durationMinutes('14:00', '14:00')).toBeNull()
    expect(durationMinutes('15:00', '14:00')).toBeNull()
    expect(durationMinutes('25:00', '26:00')).toBeNull()
  })
  it('formats', () => expect(formatDuration(60)).toBe('60 min'))
})

describe('dates and headings', () => {
  it('formats a date without any time zone shift', () => {
    expect(formatDate('2026-09-24')).toBe('Sep 24, 2026')
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026')
    expect(formatDate('2026-12-31')).toBe('Dec 31, 2026')
    expect(formatDate('soon')).toBe('soon')
  })
  it('joins series and date', () => {
    expect(meetingHeading('Supervision', '2026-09-24')).toBe('Supervision · Sep 24, 2026')
    expect(meetingHeading('', '2026-09-24')).toBe('Meeting · Sep 24, 2026')
    expect(meetingHeading('Other', '')).toBe('Other')
  })
})
