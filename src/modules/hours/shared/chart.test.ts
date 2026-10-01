import { describe, expect, it } from 'vitest'
import { columnPath, niceAxis, slotAt } from './chart'

describe('niceAxis', () => {
  it('rounds the top up to a whole step and lists the ticks', () => {
    expect(niceAxis(3150, 600)).toEqual({
      top: 3600,
      ticks: [0, 600, 1200, 1800, 2400, 3000, 3600]
    })
  })
  it('keeps one step of height when there is no data', () => {
    expect(niceAxis(0, 600)).toEqual({ top: 600, ticks: [0, 600] })
  })
  it('does not add a step when the maximum is exactly on one', () => {
    expect(niceAxis(1200, 600).top).toBe(1200)
  })
})

describe('columnPath', () => {
  it('is empty for a column with no height', () => {
    expect(columnPath(0, 10, 20, 0, 4)).toBe('')
  })
  it('caps the radius by the height and half the width', () => {
    expect(columnPath(0, 0, 10, 2, 4)).toContain('V2Q0 0 2 0')
    expect(columnPath(0, 0, 4, 50, 4)).toContain('V2Q0 0 2 0')
  })
})

describe('slotAt', () => {
  it('finds the slot under a position and refuses one outside', () => {
    expect(slotAt(50, 40, 10, 5)).toBe(1)
    expect(slotAt(39, 40, 10, 5)).toBeNull()
    expect(slotAt(90, 40, 10, 5)).toBeNull()
  })
})
