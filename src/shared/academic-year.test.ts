import { describe, expect, it } from 'vitest'
import {
  academicYearLabel,
  academicYearOf,
  academicYearRange,
  academicYearsPresent,
  currentAcademicYear,
  inAcademicYear
} from './academic-year'

describe('academic year', () => {
  it('starts on 1 September and ends on 31 August', () => {
    expect(academicYearOf('2025-08-31')).toBe(2024)
    expect(academicYearOf('2025-09-01')).toBe(2025)
    expect(academicYearOf('2026-08-31')).toBe(2025)
    expect(academicYearOf('2026-01-15')).toBe(2025)
    expect(academicYearOf('2025-12-31')).toBe(2025)
  })

  it('has no year for something that is not a date', () => {
    expect(academicYearOf('')).toBeNull()
    expect(academicYearOf('soon')).toBeNull()
  })

  it('labels years with an en dash and a two-digit end, also across a century', () => {
    expect(academicYearLabel(2025)).toBe('2025–26')
    expect(academicYearLabel(2099)).toBe('2099–00')
  })

  it('gives the first and last day', () => {
    expect(academicYearRange(2025)).toEqual({ from: '2025-09-01', to: '2026-08-31' })
  })

  it('finds the current year and membership', () => {
    expect(currentAcademicYear('2026-09-25')).toBe(2026)
    expect(inAcademicYear('2026-07-29', 2025)).toBe(true)
    expect(inAcademicYear('2026-09-01', 2025)).toBe(false)
  })

  it('offers every year with a date plus the current one, newest first', () => {
    expect(academicYearsPresent(['2024-10-01', '2025-11-02', 'x'], '2026-09-25')).toEqual([
      2026, 2025, 2024
    ])
    expect(academicYearsPresent([], '2026-01-01')).toEqual([2025])
  })
})
