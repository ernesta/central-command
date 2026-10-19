import { describe, expect, it } from 'vitest'
import {
  addDays,
  dateMatches,
  dayItem,
  parseDateRange,
  parsePeriod,
  weekStart,
  yearItem
} from './search-dates'

const TODAY = '2026-10-19' // a Monday

describe('parseDateRange', () => {
  it('reads a day, a month and a year as the days they cover', () => {
    expect(parseDateRange('2026-05-03', TODAY)).toEqual({ from: '2026-05-03', to: '2026-05-03' })
    expect(parseDateRange('2026-02', TODAY)).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(parseDateRange('2028-02', TODAY)).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(parseDateRange('2026', TODAY)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })
  it('reads today and yesterday', () => {
    expect(parseDateRange('today', TODAY)).toEqual({ from: TODAY, to: TODAY })
    expect(parseDateRange('yesterday', TODAY)).toEqual({ from: '2026-10-18', to: '2026-10-18' })
    expect(parseDateRange('yesterday', '2026-03-01')?.from).toBe('2026-02-28')
  })
  it('refuses what is not a real date or not listed', () => {
    for (const v of ['2026-02-30', '2026-13', '2026-00', 'oct 3', 'tomorrow', '26', 'this week'])
      expect(parseDateRange(v, TODAY)).toBeNull()
  })
})

describe('parsePeriod', () => {
  it('runs weeks Monday to Sunday', () => {
    expect(parsePeriod('this week', TODAY)).toEqual({ from: '2026-10-19', to: '2026-10-25' })
    expect(parsePeriod('this week', '2026-10-25')).toEqual({ from: '2026-10-19', to: '2026-10-25' })
    expect(parsePeriod('last week', TODAY)).toEqual({ from: '2026-10-12', to: '2026-10-18' })
  })
  it('knows months and years, across a year end', () => {
    expect(parsePeriod('this month', TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(parsePeriod('last month', '2026-01-15')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31'
    })
    expect(parsePeriod('last year', TODAY)).toEqual({ from: '2025-01-01', to: '2025-12-31' })
    expect(parsePeriod('this year', TODAY)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })
  it('takes a month, a year, today and yesterday, but not a day', () => {
    expect(parsePeriod('2026-09', TODAY)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(parsePeriod('2026', TODAY)?.from).toBe('2026-01-01')
    expect(parsePeriod('today', TODAY)?.from).toBe(TODAY)
    expect(parsePeriod('2026-09-03', TODAY)).toBeNull()
    expect(parsePeriod('next week', TODAY)).toBeNull()
  })
})

describe('days', () => {
  it('adds days across months and finds the Monday', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(weekStart('2026-10-25')).toBe('2026-10-19')
    expect(weekStart('2026-10-19')).toBe('2026-10-19')
  })
})

describe('dateMatches', () => {
  const may = { from: '2026-05-01', to: '2026-05-31' }
  it('before is strictly before the first day, after strictly after the last', () => {
    expect(dateMatches('before', may, dayItem('2026-04-30'))).toBe(true)
    expect(dateMatches('before', may, dayItem('2026-05-01'))).toBe(false)
    expect(dateMatches('after', may, dayItem('2026-06-01'))).toBe(true)
    expect(dateMatches('after', may, dayItem('2026-05-31'))).toBe(false)
  })
  it('on and during are inside the range', () => {
    expect(dateMatches('on', may, dayItem('2026-05-31'))).toBe(true)
    expect(dateMatches('during', may, dayItem('2026-06-01'))).toBe(false)
  })
  it('an item with no date matches none', () => {
    for (const name of ['before', 'after', 'on', 'during'] as const)
      expect(dateMatches(name, may, dayItem(''))).toBe(false)
  })
  it('a reading covers its year', () => {
    const y2026 = { from: '2026-01-01', to: '2026-12-31' }
    expect(dateMatches('on', y2026, yearItem(2026))).toBe(true)
    expect(dateMatches('during', may, yearItem(2026))).toBe(false)
    expect(dateMatches('before', may, yearItem(2025))).toBe(true)
    expect(dateMatches('before', may, yearItem(2026))).toBe(false)
    expect(dateMatches('after', may, yearItem(2027))).toBe(true)
    expect(dateMatches('on', may, yearItem(null))).toBe(false)
  })
})
