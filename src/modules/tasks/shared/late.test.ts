import { describe, expect, it } from 'vitest'
import { daysLate, lateLabel } from './late'

describe('daysLate', () => {
  it('counts calendar days from the due date to today', () => {
    expect(daysLate('2026-10-10', '2026-10-15')).toBe(5)
    expect(daysLate('2026-12-30', '2027-01-02')).toBe(3)
  })
  it('is 0 today, in the future and with no date', () => {
    expect(daysLate('2026-10-15', '2026-10-15')).toBe(0)
    expect(daysLate('2026-10-16', '2026-10-15')).toBe(0)
    expect(daysLate(null, '2026-10-15')).toBe(0)
  })
  it('says the label', () => {
    expect(lateLabel(1)).toBe('1 day late')
    expect(lateLabel(103)).toBe('103 days late')
  })
})
