import { describe, expect, it } from 'vitest'
import {
  ALL_YEARS,
  inScopeYear,
  isAllYears,
  offeredYears,
  periodOf,
  scopeYearStarts,
  singleYear,
  validYearScope
} from './year-scope'

const STARTS = ['2024-09-23', '2025-09-22', '2026-09-21']
const OFFERED = ['2026-09-21', '2025-09-22', '2024-09-23']

describe('validYearScope', () => {
  it('accepts All and a year on offer, and nothing else', () => {
    expect(validYearScope('all', OFFERED)).toBe('all')
    expect(validYearScope('2025-09-22', OFFERED)).toBe('2025-09-22')
    // A removed year, a date that is no year's start, and junk.
    expect(validYearScope('2019-09-23', OFFERED)).toBeNull()
    expect(validYearScope('2025-09-23', OFFERED)).toBeNull()
    expect(validYearScope(undefined, OFFERED)).toBeNull()
    expect(validYearScope(5, OFFERED)).toBeNull()
  })

  it('is the same All as Work’s', () => {
    expect(ALL_YEARS).toBe('all')
    expect(isAllYears('all')).toBe(true)
    expect(isAllYears('2025-09-22')).toBe(false)
  })
})

describe('scopeYearStarts', () => {
  it('covers every year under All, in the order given, and only the chosen one otherwise', () => {
    expect(scopeYearStarts('all', OFFERED)).toEqual(OFFERED)
    expect(scopeYearStarts('2025-09-22', OFFERED)).toEqual(['2025-09-22'])
  })
})

describe('inScopeYear', () => {
  it('counts every date, and an undated item, under All', () => {
    expect(inScopeYear('all', '2020-01-01')).toBe(true)
    expect(inScopeYear('all', '')).toBe(true)
  })

  it('counts a date inside the one year only, the first and last day in the year that holds them', () => {
    const y25 = '2025-09-22'
    const y26 = '2026-09-21'
    // 2025-09-22 to 2026-09-20 is one year; 2026-09-21 starts the next.
    expect(inScopeYear(y25, '2025-09-21')).toBe(false)
    expect(inScopeYear(y25, '2025-09-22')).toBe(true)
    expect(inScopeYear(y25, '2026-09-20')).toBe(true)
    expect(inScopeYear(y25, '2026-09-21')).toBe(false)
    expect(inScopeYear(y26, '2026-09-20')).toBe(false)
    expect(inScopeYear(y26, '2026-09-21')).toBe(true)
    expect(inScopeYear(y26, '2027-09-19')).toBe(true)
    expect(inScopeYear(y26, '2027-09-20')).toBe(false)
  })

  it('does not count an undated item in one year', () => {
    expect(inScopeYear('2025-09-22', '')).toBe(false)
  })
})

describe('singleYear', () => {
  it('is the chosen year, or the current year under All', () => {
    expect(singleYear('2025-09-22', '2026-11-03', STARTS)).toBe('2025-09-22')
    expect(singleYear('all', '2026-11-03', STARTS)).toBe('2026-09-21')
    expect(singleYear('all', '2026-09-20', STARTS)).toBe('2025-09-22')
  })
})

describe('periodOf', () => {
  it('is null under All, which the meeting and training rules take as every year', () => {
    expect(periodOf('all')).toBeNull()
    expect(periodOf('2025-09-22')).toBe('2025-09-22')
  })
})

describe('offeredYears', () => {
  it('lists every listed year newest first, with the next year so its plan can be written', () => {
    expect(offeredYears('2026-11-03', STARTS)).toEqual([
      '2027-09-20',
      '2026-09-21',
      '2025-09-22',
      '2024-09-23'
    ])
  })

  it('adds a year that has a file but is no longer listed, and ignores a date that is no year start', () => {
    expect(offeredYears('2026-11-03', STARTS, ['2023-09-25', '2025-09-23'])).toEqual([
      '2027-09-20',
      '2026-09-21',
      '2025-09-22',
      '2024-09-23',
      '2023-09-25'
    ])
  })

  it('has the same year once when the current one is also listed or in a file', () => {
    const years = offeredYears('2026-11-03', STARTS, ['2026-09-21'])
    expect(years.filter((y) => y === '2026-09-21')).toHaveLength(1)
  })

  it('offers only the current year (today’s own week) before the first year is set', () => {
    expect(offeredYears('2026-11-03', [])).toEqual(['2026-11-02'])
  })
})
