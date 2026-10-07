import { describe, expect, it } from 'vitest'
import { parseQuarterHours } from './tasks'

describe('parseQuarterHours', () => {
  it('accepts whole quarter hours in any of the typed forms', () => {
    expect(parseQuarterHours('1:15')).toBe(75)
    expect(parseQuarterHours('2')).toBe(120)
    expect(parseQuarterHours('1.25')).toBe(75)
    expect(parseQuarterHours('0:00')).toBe(0)
  })
  it('refuses minutes that are not a quarter hour, and anything else', () => {
    expect(parseQuarterHours('1:20')).toBeNull()
    expect(parseQuarterHours('1.1')).toBeNull()
    expect(parseQuarterHours('abc')).toBeNull()
    expect(parseQuarterHours('')).toBeNull()
    expect(parseQuarterHours('-1')).toBeNull()
  })
})
