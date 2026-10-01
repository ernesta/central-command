import { describe, expect, it } from 'vitest'
import {
  durationMinutes,
  formatDate,
  formatDuration,
  formatShortDate,
  meetingHeading,
  trackingMoment
} from './time'

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
  it('formats in hours and minutes', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(90)).toBe('1 h 30 min')
    expect(formatDuration(450)).toBe('7 h 30 min')
  })
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
    expect(meetingHeading('Other', '')).toBe('Other · No date yet')
  })
})

describe('formatShortDate', () => {
  it('drops the year', () => {
    expect(formatShortDate('2026-09-24')).toBe('Sep 24')
    expect(formatShortDate('2026-01-05')).toBe('Jan 5')
    expect(formatShortDate('soon')).toBe('soon')
  })
})

describe('trackingMoment', () => {
  it('keeps the calendar day from 04:00 on', () => {
    expect(trackingMoment(new Date(2026, 9, 1, 4, 0, 0))).toEqual({
      date: '2026-10-01',
      time: '04:00:00'
    })
    expect(trackingMoment(new Date(2026, 9, 1, 23, 59, 59))).toEqual({
      date: '2026-10-01',
      time: '23:59:59'
    })
  })
  it('counts the small hours as the end of the day before, past 24:00', () => {
    expect(trackingMoment(new Date(2026, 9, 1, 0, 5, 0))).toEqual({
      date: '2026-09-30',
      time: '24:05:00'
    })
    expect(trackingMoment(new Date(2026, 9, 1, 3, 59, 59))).toEqual({
      date: '2026-09-30',
      time: '27:59:59'
    })
    expect(trackingMoment(new Date(2026, 0, 1, 1, 0, 0))).toEqual({
      date: '2025-12-31',
      time: '25:00:00'
    })
  })
})
