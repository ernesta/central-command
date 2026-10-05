import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DebouncedSaver } from './debounced-saver'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('DebouncedSaver', () => {
  it('reports the text and the dirty state synchronously, before any timer', () => {
    const saver = new DebouncedSaver('a', async () => undefined)
    saver.change('ab')
    expect(saver.current).toBe('ab')
    expect(saver.getSnapshot().state).toBe('dirty')
  })

  it('writes once after the pause, with the latest text', async () => {
    const save = vi.fn(async () => undefined)
    const saver = new DebouncedSaver('', save, 400)
    saver.change('h')
    saver.change('he')
    saver.change('hey')
    await vi.advanceTimersByTimeAsync(399)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('hey')
    expect(saver.getSnapshot().state).toBe('clean')
  })

  it('flush writes at once what was typed a moment ago (quit right after typing)', async () => {
    const save = vi.fn(async () => undefined)
    const saver = new DebouncedSaver('', save)
    saver.change('last words')
    await saver.flush()
    expect(save).toHaveBeenCalledWith('last words')
  })

  it('writes what was typed while a write was in flight, after it', async () => {
    const writes: string[] = []
    let release: () => void = () => undefined
    const save = vi.fn(async (text: string) => {
      writes.push(text)
      if (writes.length === 1) await new Promise<void>((r) => (release = r))
    })
    const saver = new DebouncedSaver('', save)
    saver.change('one')
    const first = saver.flush()
    saver.change('one two')
    const second = saver.flush()
    release()
    await Promise.all([first, second])
    expect(writes).toEqual(['one', 'one two'])
    expect(saver.getSnapshot().state).toBe('clean')
  })

  it('keeps the text and says so when a write fails, and tries again on flush', async () => {
    const save = vi
      .fn<(t: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValue(undefined)
    const saver = new DebouncedSaver('', save)
    saver.change('keep me')
    await saver.flush()
    expect(saver.getSnapshot()).toEqual({ state: 'error', error: 'disk full' })
    expect(saver.current).toBe('keep me')
    await saver.flush()
    expect(saver.getSnapshot().state).toBe('clean')
    expect(save).toHaveBeenLastCalledWith('keep me')
  })

  it('does not write when the text is back to what was saved', async () => {
    const save = vi.fn(async () => undefined)
    const saver = new DebouncedSaver('same', save)
    saver.change('different')
    saver.change('same')
    await saver.flush()
    expect(save).not.toHaveBeenCalled()
    expect(saver.getSnapshot().state).toBe('clean')
  })
})
