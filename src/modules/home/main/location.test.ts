import { describe, expect, it } from 'vitest'
import { LOCATION_CACHE_MS, LOCATION_FAILURE_MS, LocationService, parseLocation } from './location'

const GOOD = '{"latitude":51.43123,"longitude":-0.55987,"place":"Egham"}'

describe('parseLocation', () => {
  it('rounds the position to a town', () => {
    expect(parseLocation(GOOD)).toEqual({
      ok: true,
      latitude: 51.4,
      longitude: -0.6,
      place: 'Egham'
    })
    expect(parseLocation('{"latitude":51.4,"longitude":-0.6}')).toMatchObject({ place: '' })
  })
  it('tells a refusal from every other failure', () => {
    expect(parseLocation('{"error":"denied"}')).toEqual({ ok: false, reason: 'denied' })
    expect(parseLocation('{"error":"unavailable"}')).toEqual({ ok: false, reason: 'unavailable' })
    expect(parseLocation('')).toEqual({ ok: false, reason: 'unavailable' })
    expect(parseLocation('not json')).toEqual({ ok: false, reason: 'unavailable' })
    expect(parseLocation('{"latitude":200,"longitude":0}')).toEqual({
      ok: false,
      reason: 'unavailable'
    })
    expect(parseLocation('{"latitude":"51","longitude":0}')).toEqual({
      ok: false,
      reason: 'unavailable'
    })
  })
})

describe('LocationService', () => {
  const counted = (
    outputs: (string | Error)[]
  ): { run: () => Promise<string>; calls: number[] } => {
    const calls: number[] = []
    return {
      calls,
      run: async () => {
        const next = outputs[Math.min(calls.length, outputs.length - 1)]
        calls.push(calls.length)
        if (next instanceof Error) throw next
        return next
      }
    }
  }

  it('is unavailable where there is no helper', async () => {
    expect(await new LocationService(null).current()).toEqual({
      ok: false,
      reason: 'unavailable'
    })
  })

  it('asks Location Services at most every half hour, even when asked together', async () => {
    let now = 0
    const { run, calls } = counted([GOOD])
    const s = new LocationService(run, () => now)
    await Promise.all([s.current(), s.current()])
    now += LOCATION_CACHE_MS - 1
    await s.current()
    expect(calls).toHaveLength(1)
    now += 2
    await s.current()
    expect(calls).toHaveLength(2)
  })

  it('tries a failure again sooner, and forget() asks at once', async () => {
    let now = 0
    const { run, calls } = counted(['{"error":"denied"}', GOOD])
    const s = new LocationService(run, () => now)
    expect((await s.current()).ok).toBe(false)
    now += LOCATION_FAILURE_MS - 1
    await s.current()
    expect(calls).toHaveLength(1)
    s.forget()
    expect(await s.current()).toMatchObject({ ok: true })
    expect(calls).toHaveLength(2)
  })

  it('keeps the last position when a later read fails, but not when permission was taken away', async () => {
    let now = 0
    const { run } = counted([GOOD, new Error('timed out'), '{"error":"denied"}'])
    const s = new LocationService(run, () => now)
    const first = await s.current()
    now += LOCATION_CACHE_MS + 1
    expect(await s.current()).toEqual(first)
    now += LOCATION_CACHE_MS + 1
    expect(await s.current()).toEqual({ ok: false, reason: 'denied' })
  })
})
