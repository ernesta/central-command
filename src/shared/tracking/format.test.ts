import { describe, expect, it } from 'vitest'
import { formatHours, formatSignedHours, parseHours } from './format'

describe('formatHours', () => {
  it('shows hours and minutes, never decimals', () => {
    expect(formatHours(465)).toBe('7:45')
    expect(formatHours(0)).toBe('0:00')
    expect(formatHours(5)).toBe('0:05')
    expect(formatHours(91410)).toBe('1,523:30')
  })
  it('uses a real minus sign, and none for a rounded-away zero', () => {
    expect(formatHours(-150)).toBe('−2:30')
    expect(formatHours(-0.2)).toBe('0:00')
  })
  it('rounds a fraction of a minute to the nearest minute, halves up', () => {
    expect(formatHours(2077.5)).toBe('34:38')
    expect(formatHours(2077.4)).toBe('34:37')
  })
  it('signs a balance', () => {
    expect(formatSignedHours(150)).toBe('+2:30')
    expect(formatSignedHours(-7590)).toBe('−126:30')
    expect(formatSignedHours(0)).toBe('0:00')
  })
})

describe('parseHours', () => {
  it('reads hours and minutes, whole hours and decimal hours', () => {
    expect(parseHours('7:45')).toBe(465)
    expect(parseHours(' 0:15 ')).toBe(15)
    expect(parseHours('2')).toBe(120)
    expect(parseHours('1.5')).toBe(90)
    expect(parseHours('1,25')).toBe(75)
  })
  it('refuses anything else', () => {
    for (const bad of ['', 'x', '1:75', '-1:00', '1:5', '1:2:3', '12345'])
      expect(parseHours(bad)).toBeNull()
  })
})
