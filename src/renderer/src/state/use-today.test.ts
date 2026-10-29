import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeToday } from './use-today'

describe('the shared today', () => {
  const focusHandlers: Array<() => void> = []

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 28, 23, 59, 40))
    focusHandlers.length = 0
    vi.stubGlobal('window', {
      addEventListener: (_: string, fn: () => void) => focusHandlers.push(fn),
      removeEventListener: () => undefined
    })
    vi.stubGlobal('document', {
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('tells listeners when midnight passes, with nothing else happening', () => {
    const changed = vi.fn()
    const off = subscribeToday(changed)
    vi.advanceTimersByTime(20_000)
    expect(changed).not.toHaveBeenCalled()
    vi.advanceTimersByTime(40_000)
    expect(changed).toHaveBeenCalledTimes(1)
    off()
  })

  it('catches up when the window comes back after a sleep', () => {
    const changed = vi.fn()
    const off = subscribeToday(changed)
    vi.setSystemTime(new Date(2026, 9, 29, 8, 20))
    for (const handler of focusHandlers) handler()
    expect(changed).toHaveBeenCalled()
    off()
  })
})
