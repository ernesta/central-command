import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushAll, registerFlushable } from './flush-registry'

const cleanups: (() => void)[] = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.()
})
const register = (fn: () => Promise<void> | void): void => {
  cleanups.push(registerFlushable(fn))
}

describe('flush registry', () => {
  it('runs every registered flush and waits for async ones', async () => {
    const order: string[] = []
    register(() => order.push('sync'))
    register(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      order.push('async')
    })
    await flushAll()
    expect(order.sort()).toEqual(['async', 'sync'])
  })

  it('keeps going when one flush fails', async () => {
    const good = vi.fn()
    register(() => {
      throw new Error('boom')
    })
    register(async () => {
      throw new Error('async boom')
    })
    register(good)
    await expect(flushAll()).resolves.toBeUndefined()
    expect(good).toHaveBeenCalledOnce()
  })

  it('stops running a flush once unregistered', async () => {
    const flush = vi.fn()
    const off = registerFlushable(flush)
    off()
    await flushAll()
    expect(flush).not.toHaveBeenCalled()
  })

  it('is fine with nothing registered', async () => {
    await expect(flushAll()).resolves.toBeUndefined()
  })
})
