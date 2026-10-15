import { describe, expect, it } from 'vitest'
import { makeNetFetcher } from './net-fetcher'

const ok = (over: Record<string, unknown> = {}): never =>
  (async () => ({
    status: 200,
    url: 'https://ex.org/a',
    headers: { get: (n: string) => (n === 'content-length' ? '10' : null) },
    text: async () => 'hello',
    ...over
  })) as never

describe('makeNetFetcher', () => {
  it('returns the body and passes the headers on', async () => {
    let seen: Record<string, string> = {}
    const f = makeNetFetcher((async (_u: string, init: { headers: Record<string, string> }) => {
      seen = init.headers
      return {
        status: 200,
        url: 'https://ex.org/a',
        headers: { get: () => null },
        text: async () => 'hi'
      }
    }) as never)
    const r = await f('https://ex.org/a', { headers: { 'User-Agent': 'x' } })
    expect(await r.text()).toBe('hi')
    expect(seen).toEqual({ 'User-Agent': 'x' })
  })

  it('refuses a redirect to a private address or a non-web scheme', async () => {
    await expect(
      makeNetFetcher(ok({ url: 'http://192.168.0.1/admin' }))('https://ex.org/a', { headers: {} })
    ).rejects.toThrow('public')
    await expect(
      makeNetFetcher(ok({ url: 'file:///etc/passwd' }))('https://ex.org/a', { headers: {} })
    ).rejects.toThrow()
  })

  it('refuses to fetch a private address in the first place', async () => {
    await expect(makeNetFetcher(ok())('http://localhost/x', { headers: {} })).rejects.toThrow()
  })

  it('refuses a body that is too large, by header or by length', async () => {
    const big = { get: (n: string) => (n === 'content-length' ? String(6 * 1024 * 1024) : null) }
    await expect(
      makeNetFetcher(ok({ headers: big }))('https://ex.org/a', { headers: {} })
    ).rejects.toThrow('too large')
    await expect(
      makeNetFetcher(ok({ text: async () => 'x'.repeat(5 * 1024 * 1024 + 1) }))(
        'https://ex.org/a',
        { headers: {} }
      )
    ).rejects.toThrow('too large')
  })

  it('lets a 304 through without reading a body', async () => {
    const r = await makeNetFetcher(ok({ status: 304 }))('https://ex.org/a', { headers: {} })
    expect(r.status).toBe(304)
  })

  it('times out', async () => {
    const slow = (async (_u: string, init: { signal: AbortSignal }) =>
      new Promise((_, reject) =>
        init.signal.addEventListener('abort', () => reject(new Error('timed out')))
      )) as never
    await expect(makeNetFetcher(slow, 5)('https://ex.org/a', { headers: {} })).rejects.toThrow(
      'timed out'
    )
  })
})
