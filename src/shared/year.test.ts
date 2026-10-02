import { describe, expect, it } from 'vitest'
import {
  addDays,
  currentYear,
  daysBetween,
  defaultNextStart,
  inYear,
  isMonday,
  nextYearStart,
  startYearLabel,
  normaliseYearStarts,
  rolloverStarts,
  weekNumberOf,
  weekStartOf,
  weekdayOf,
  weeksOf,
  withNextStart,
  yearEnd,
  yearLabel,
  yearStartOf,
  yearsPresent
} from './year'

const STARTS = ['2025-09-22', '2026-09-21']

describe('dates', () => {
  it('knows weekdays (Monday is 1) and rejects non-dates', () => {
    expect(weekdayOf('2026-09-21')).toBe(1)
    expect(weekdayOf('2026-09-27')).toBe(7)
    expect(weekdayOf('1970-01-01')).toBe(4)
    expect(isMonday('2026-09-21')).toBe(true)
    expect(isMonday('2026-02-30')).toBe(false)
    expect(isMonday('nope')).toBe(false)
  })
  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-09-21', -1)).toBe('2026-09-20')
    expect(daysBetween('2025-09-22', '2026-09-21')).toBe(364)
  })
  it('finds the Monday of a week', () => {
    expect(weekStartOf('2026-09-27')).toBe('2026-09-21')
    expect(weekStartOf('2026-09-21')).toBe('2026-09-21')
  })
})

describe('the year', () => {
  it('is 52 weeks: the sheet years', () => {
    expect(yearEnd('2025-09-22')).toBe('2026-09-20')
    expect(yearEnd('2026-09-21')).toBe('2027-09-19')
    expect(yearLabel('2025-09-22')).toBe('2025–26')
    expect(yearLabel('2099-09-21')).toBe('2099–00')
  })
  it('gives a date its year, edges included', () => {
    expect(yearStartOf('2025-09-22', STARTS)).toBe('2025-09-22')
    expect(yearStartOf('2026-09-20', STARTS)).toBe('2025-09-22')
    expect(yearStartOf('2026-09-21', STARTS)).toBe('2026-09-21')
    expect(yearStartOf('2027-09-19', STARTS)).toBe('2026-09-21')
    expect(yearStartOf('nope', STARTS)).toBeNull()
    expect(yearStartOf('2026-01-01', [])).toBeNull()
  })
  it('derives years before the first and after the last start, 52 weeks each', () => {
    expect(yearStartOf('2025-09-21', STARTS)).toBe('2024-09-23')
    expect(yearStartOf('2024-09-23', STARTS)).toBe('2024-09-23')
    expect(yearStartOf('2020-01-01', STARTS)).toBe('2019-09-30')
    expect(yearStartOf('2027-09-20', STARTS)).toBe('2027-09-20')
    expect(yearStartOf('2028-09-17', STARTS)).toBe('2027-09-20')
  })
  it('leaves a gap between two listed years in no year', () => {
    const gap = ['2025-09-22', '2026-10-05']
    expect(yearStartOf('2026-09-21', gap)).toBeNull()
    expect(yearStartOf('2026-10-04', gap)).toBeNull()
    expect(yearStartOf('2026-10-05', gap)).toBe('2026-10-05')
  })
  it('checks membership', () => {
    expect(inYear('2026-09-20', '2025-09-22')).toBe(true)
    expect(inYear('2026-09-21', '2025-09-22')).toBe(false)
    expect(inYear('2025-09-21', '2025-09-22')).toBe(false)
  })
  it('numbers weeks from 1 and has 52', () => {
    const weeks = weeksOf('2025-09-22')
    expect(weeks).toHaveLength(52)
    expect(weeks[0]).toEqual({ number: 1, from: '2025-09-22', to: '2025-09-28' })
    expect(weeks[51]).toEqual({ number: 52, from: '2026-09-14', to: '2026-09-20' })
    expect(weekNumberOf('2025-09-28', '2025-09-22')).toBe(1)
    expect(weekNumberOf('2025-09-29', '2025-09-22')).toBe(2)
    expect(weekNumberOf('2026-09-20', '2025-09-22')).toBe(52)
    expect(weekNumberOf('2026-09-21', '2025-09-22')).toBeNull()
  })
})

describe('the list of starts', () => {
  it('keeps only Mondays, sorted, without repeats and at least 52 weeks apart', () => {
    expect(normaliseYearStarts(['2026-09-21', '2025-09-22', '2025-09-22'])).toEqual(STARTS)
    expect(normaliseYearStarts(['2025-09-23', 'x', 5, null])).toEqual([])
    expect(normaliseYearStarts(['2025-09-22', '2026-09-14'])).toEqual(['2025-09-22'])
    expect(normaliseYearStarts('2025-09-22')).toEqual([])
  })
  it('finds the current year, and falls back so there is always one', () => {
    expect(currentYear('2026-10-01', STARTS)).toBe('2026-09-21')
    expect(currentYear('2026-09-20', STARTS)).toBe('2025-09-22')
    expect(currentYear('2026-10-01', [])).toBe('2026-09-28')
    expect(currentYear('2026-09-28', ['2025-09-22', '2026-10-05'])).toBe('2026-10-05')
  })
  it('adds the starts of years that have begun, once', () => {
    expect(rolloverStarts(['2025-09-22'], '2026-10-01')).toEqual(STARTS)
    expect(rolloverStarts(STARTS, '2026-10-01')).toEqual(STARTS)
    expect(rolloverStarts(STARTS, '2027-09-19')).toEqual(STARTS)
    expect(rolloverStarts(STARTS, '2027-09-20')).toEqual([...STARTS, '2027-09-20'])
    expect(rolloverStarts(STARTS, '2029-01-01')).toHaveLength(4)
    expect(rolloverStarts([], '2026-10-01')).toEqual([])
  })
  it('defaults the next start to 52 weeks on', () => {
    expect(defaultNextStart(STARTS, '2026-10-01')).toBe('2027-09-20')
  })
  it('edits the next start only while it has not begun, on a Monday, never shortening a year', () => {
    expect(withNextStart(STARTS, '2027-10-04', '2026-10-01')).toEqual([...STARTS, '2027-10-04'])
    expect(withNextStart(STARTS, '2027-09-20', '2026-10-01')).toEqual([...STARTS, '2027-09-20'])
    expect(withNextStart(STARTS, '2027-09-13', '2026-10-01')).toBeNull()
    expect(withNextStart(STARTS, '2027-10-05', '2026-10-01')).toBeNull()
    expect(withNextStart(STARTS, '2026-09-28', '2026-10-01')).toBeNull()
    // already edited once: the later value replaces the earlier
    const once = withNextStart(STARTS, '2027-10-04', '2026-10-01')!
    expect(withNextStart(once, '2027-09-27', '2026-10-01')).toEqual([...STARTS, '2027-09-27'])
    // a start that has begun is history, and a year is never shortened
    expect(withNextStart([...STARTS, '2027-09-20'], '2027-10-04', '2027-09-21')).toBeNull()
  })
  it('offers every year with a date plus the current one, newest first', () => {
    expect(yearsPresent(['2025-10-01'], '2026-10-01', STARTS)).toEqual(['2026-09-21', '2025-09-22'])
    expect(yearsPresent([], '2026-10-01', STARTS)).toEqual(['2026-09-21'])
    expect(yearsPresent(['2024-10-01', 'x'], '2026-10-01', STARTS)).toEqual([
      '2026-09-21',
      '2024-09-23'
    ])
  })
})

describe('nextYearStart and startYearLabel', () => {
  it('is the next listed start, else 52 weeks on from the current year', () => {
    expect(nextYearStart('2026-09-26', ['2025-09-22', '2026-09-21'])).toBe('2027-09-20')
    expect(nextYearStart('2026-03-01', ['2025-09-22', '2026-09-21'])).toBe('2026-09-21')
  })
  it('names a year by the calendar year it starts in', () => {
    expect(startYearLabel(2026)).toBe('2026–27')
    expect(startYearLabel(2099)).toBe('2099–00')
  })
})
