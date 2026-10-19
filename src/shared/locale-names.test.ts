import { describe, expect, it } from 'vitest'
import {
  firstWeekday,
  formatClock,
  localeDate,
  monthName,
  uses12HourClock,
  weekdayName
} from './locale-names'

// The tests run in US English (vitest.config.ts), so the expected text is fixed.
describe('locale names', () => {
  it('writes a plain date in the parts asked for, with no time zone', () => {
    expect(localeDate('2026-09-24', { month: 'short', day: 'numeric', year: 'numeric' })).toBe(
      'Sep 24, 2026'
    )
    expect(localeDate('2026-01-01', { month: 'short', day: 'numeric' })).toBe('Jan 1')
  })

  it('returns anything that is not a date as it is', () => {
    expect(localeDate('soon', { month: 'short' })).toBe('soon')
    expect(localeDate('2026-9-24', { month: 'short' })).toBe('2026-9-24')
  })

  it('names the months and the weekdays from Monday', () => {
    expect(monthName(1)).toBe('Jan')
    expect(monthName(12, 'long')).toBe('December')
    expect(weekdayName(1)).toBe('Mon')
    expect(weekdayName(7, 'long')).toBe('Sunday')
    expect([1, 2, 3, 4, 5, 6, 7].map((d) => weekdayName(d, 'narrow')).join('')).toBe('MTWTFSS')
  })
})

describe('firstWeekday', () => {
  it('is Sunday for US English', () => {
    expect(firstWeekday()).toBe(7)
  })
})

describe('formatClock', () => {
  it('writes a time the way the region does (12-hour in US English)', () => {
    expect(uses12HourClock()).toBe(true)
    expect(formatClock('14:00')).toBe('2:00 PM')
    expect(formatClock('09:15:00')).toBe('9:15 AM')
    expect(formatClock('00:30')).toBe('12:30 AM')
  })
  it('returns anything that is not a time as it is', () => {
    expect(formatClock('now')).toBe('now')
  })
})
