import { describe, expect, it } from 'vitest'
import { monthGrid, shiftMonth } from './calendar'

describe('calendar', () => {
  it('moves between months across a year', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
  it('lays a month out in whole weeks from Monday', () => {
    const grid = monthGrid('2026-10')
    expect(grid[0]).toBe('2026-09-28')
    expect(grid.at(-1)).toBe('2026-11-01')
    expect(grid.length % 7).toBe(0)
  })
  it('does not add a spare week when the month ends on a Sunday', () => {
    expect(monthGrid('2026-05').at(-1)).toBe('2026-05-31')
  })
})
