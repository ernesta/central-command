import { describe, expect, it } from 'vitest'
import { parseAllowance, parseWeekHours, toggleWorkDay } from './plan-settings'

describe('toggleWorkDay', () => {
  it('adds a day and keeps the week in order', () => {
    expect(toggleWorkDay([1, 2, 3, 4, 5], 6)).toEqual([1, 2, 3, 4, 5, 6])
    expect(toggleWorkDay([1, 3], 2)).toEqual([1, 2, 3])
  })
  it('removes a day', () => {
    expect(toggleWorkDay([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 4, 5])
  })
  it('never leaves no day worked', () => {
    expect(toggleWorkDay([2], 2)).toBeNull()
  })
  it('does not change the list it was given', () => {
    const days = [1, 2]
    toggleWorkDay(days, 3)
    expect(days).toEqual([1, 2])
  })
})

describe('parseWeekHours', () => {
  it('reads hours and minutes or decimal hours', () => {
    expect(parseWeekHours('37:30')).toBe(2250)
    expect(parseWeekHours('37.5')).toBe(2250)
    expect(parseWeekHours('8')).toBe(480)
  })
  it('refuses none, more than a week, and anything else', () => {
    expect(parseWeekHours('0')).toBeNull()
    expect(parseWeekHours('0:00')).toBeNull()
    expect(parseWeekHours('169')).toBeNull()
    expect(parseWeekHours('abc')).toBeNull()
    expect(parseWeekHours('')).toBeNull()
  })
})

describe('parseAllowance', () => {
  it('accepts whole days from 0 to 366', () => {
    expect(parseAllowance('40')).toBe(40)
    expect(parseAllowance(' 0 ')).toBe(0)
    expect(parseAllowance('366')).toBe(366)
  })
  it('refuses the rest', () => {
    expect(parseAllowance('367')).toBeNull()
    expect(parseAllowance('-1')).toBeNull()
    expect(parseAllowance('2.5')).toBeNull()
    expect(parseAllowance('')).toBeNull()
  })
})
