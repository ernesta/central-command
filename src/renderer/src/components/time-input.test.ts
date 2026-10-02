import { describe, expect, it } from 'vitest'
import { parseTime, stepTime } from './time-input'

describe('parseTime', () => {
  it('reads typed times in the usual shapes', () => {
    expect(parseTime('9:30')).toBe('09:30')
    expect(parseTime('09:30')).toBe('09:30')
    expect(parseTime('930')).toBe('09:30')
    expect(parseTime('1545')).toBe('15:45')
  })
  it('refuses what is not a time', () => {
    for (const raw of ['', '9', '25:00', '12:60', '12:', 'ab:cd']) expect(parseTime(raw)).toBeNull()
  })
})

describe('stepTime', () => {
  it('moves hours by one and minutes by fifteen', () => {
    expect(stepTime('15:00', 'hours', 1)).toBe('16:00')
    expect(stepTime('15:00', 'hours', -1)).toBe('14:00')
    expect(stepTime('15:00', 'minutes', 1)).toBe('15:15')
    expect(stepTime('15:00', 'minutes', -1)).toBe('15:45')
  })
  it('wraps each part without touching the other', () => {
    expect(stepTime('23:30', 'hours', 1)).toBe('00:30')
    expect(stepTime('00:30', 'hours', -1)).toBe('23:30')
    expect(stepTime('10:45', 'minutes', 1)).toBe('10:00')
  })
  it('starts an empty time at 09:00', () => {
    expect(stepTime('', 'hours', 1)).toBe('10:00')
    expect(stepTime('', 'minutes', 1)).toBe('09:15')
  })
})
