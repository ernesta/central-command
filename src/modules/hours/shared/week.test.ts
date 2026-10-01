import { describe, expect, it } from 'vitest'
import { BAR_SCALE, barFill, defaultWeek, resolveWeek, weekDates } from './week'

const START = '2026-09-21'

describe('defaultWeek', () => {
  it('is the week of today inside the year', () => {
    expect(defaultWeek(START, '2026-10-01')).toBe('2026-09-28')
    expect(defaultWeek(START, '2026-09-21')).toBe(START)
    expect(defaultWeek(START, '2026-09-27')).toBe(START)
  })
  it('is the first week before the year begins', () => {
    expect(defaultWeek(START, '2026-09-01')).toBe(START)
  })
  it('is the last week once the year is over', () => {
    expect(defaultWeek(START, '2028-01-01')).toBe('2027-09-13')
  })
})

describe('resolveWeek', () => {
  it('takes a Monday inside the year', () => {
    expect(resolveWeek('2026-11-02', START, '2026-10-01')).toBe('2026-11-02')
  })
  it('falls back for anything else', () => {
    expect(resolveWeek(null, START, '2026-10-01')).toBe('2026-09-28')
    expect(resolveWeek('2026-11-03', START, '2026-10-01')).toBe('2026-09-28')
    expect(resolveWeek('2026-09-14', START, '2026-10-01')).toBe('2026-09-28')
    expect(resolveWeek('2027-09-20', START, '2026-10-01')).toBe('2026-09-28')
    expect(resolveWeek('soon', START, '2026-10-01')).toBe('2026-09-28')
  })
})

describe('barFill', () => {
  it('puts the aim at 1 ÷ the scale and caps beyond it', () => {
    expect(barFill(450, 450, 450)).toBeCloseTo(1 / BAR_SCALE)
    expect(barFill(0, 450, 450)).toBe(0)
    expect(barFill(2000, 450, 450)).toBe(1)
  })
  it('measures a day without an aim against the usual day', () => {
    expect(barFill(225, null, 450)).toBeCloseTo(0.5 / BAR_SCALE)
  })
  it('is empty when there is nothing to measure against', () => {
    expect(barFill(60, null, 0)).toBe(0)
  })
})

describe('weekDates', () => {
  it('lists Monday to Sunday', () => {
    const days = weekDates('2026-09-28')
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-09-28')
    expect(days[6]).toBe('2026-10-04')
  })
})
