import { describe, expect, it } from 'vitest'
import { endFollowingStart, parseQuarterTime, parseTime, snapTime, stepTime } from './time-input'

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

describe('snapTime', () => {
  it('goes to the nearest quarter hour, halves up', () => {
    expect(snapTime('09:07')).toBe('09:00')
    expect(snapTime('09:08')).toBe('09:15')
    expect(snapTime('09:53')).toBe('10:00')
    expect(snapTime('09:30')).toBe('09:30')
  })
  it('stops at the last quarter of the day', () => {
    expect(snapTime('23:59')).toBe('23:45')
  })
  it('snaps a pasted time', () => {
    expect(parseQuarterTime('9:20')).toBe('09:15')
    expect(parseQuarterTime('nope')).toBeNull()
  })
  it('keeps a step on the quarters when the time started off them', () => {
    expect(stepTime('10:07', 'minutes', 1)).toBe('10:15')
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

describe('endFollowingStart', () => {
  it('fills an empty end an hour after the start', () => {
    expect(endFollowingStart(null, '13:00', null)).toBe('14:00')
  })
  it('keeps following the start while it is still being typed', () => {
    expect(endFollowingStart('01:00', '13:00', '02:00')).toBe('14:00')
  })
  it('leaves an end the user set alone', () => {
    expect(endFollowingStart('13:00', '13:30', '16:00')).toBe('16:00')
  })
  it('leaves the end when the start is cleared and caps at the end of the day', () => {
    expect(endFollowingStart('13:00', null, '14:00')).toBe('14:00')
    expect(endFollowingStart(null, '23:30', null)).toBe('23:45')
  })
})
