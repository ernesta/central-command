import { describe, expect, it } from 'vitest'
import { monthGrid, popoverPlace, shiftMonth } from './calendar'

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
  it('places the popover under the button, above it when the window ends, and inside the window sideways', () => {
    const button = { top: 100, bottom: 132, left: 50 }
    expect(popoverPlace(button, 1280, 900)).toEqual({ top: 136, left: 50 })
    expect(popoverPlace({ top: 700, bottom: 732, left: 50 }, 1280, 900)).toEqual({
      top: 396,
      left: 50
    })
    expect(popoverPlace({ ...button, left: 1200 }, 1280, 900).left).toBe(1024)
    expect(popoverPlace({ ...button, left: -20 }, 1280, 900).left).toBe(8)
    // no room either side: stays below
    expect(popoverPlace({ top: 100, bottom: 132, left: 50 }, 1280, 300).top).toBe(136)
  })
})
