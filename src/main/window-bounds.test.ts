import { describe, expect, it } from 'vitest'
import { restoreBounds } from './window-bounds'

const screen = { x: 0, y: 0, width: 1920, height: 1080 }
const defaults = { width: 1280, height: 820 }
const min = { width: 960, height: 600 }

describe('restoreBounds', () => {
  it('opens in the default size when nothing was saved', () => {
    expect(restoreBounds(null, [screen], defaults, min)).toEqual(defaults)
  })

  it('opens where it was left', () => {
    const saved = { x: 100, y: 50, width: 1400, height: 900 }
    expect(restoreBounds(saved, [screen], defaults, min)).toEqual(saved)
  })

  it('keeps the size but not the position when its screen is gone', () => {
    const saved = { x: 2500, y: 100, width: 1400, height: 900 }
    expect(restoreBounds(saved, [screen], defaults, min)).toEqual({ width: 1400, height: 900 })
  })

  it('keeps a window that is partly off screen as long as enough of it can be grabbed', () => {
    const saved = { x: -1000, y: 20, width: 1200, height: 800 }
    expect(restoreBounds(saved, [screen], defaults, min)).toMatchObject({ x: -1000 })
    expect(restoreBounds({ ...saved, x: -1150 }, [screen], defaults, min).x).toBeUndefined()
  })

  it('finds a window on a second screen', () => {
    const second = { x: 1920, y: 0, width: 1440, height: 900 }
    const saved = { x: 2000, y: 40, width: 1000, height: 700 }
    expect(restoreBounds(saved, [screen, second], defaults, min)).toEqual(saved)
  })

  it('never goes below the minimum size', () => {
    expect(restoreBounds({ x: 0, y: 0, width: 300, height: 200 }, [screen], defaults, min)).toEqual(
      {
        x: 0,
        y: 0,
        width: 960,
        height: 600
      }
    )
  })
})
