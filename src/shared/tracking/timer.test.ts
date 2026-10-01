import { describe, expect, it } from 'vitest'
import { carrySeconds, exactSeconds, reportedMinutes, roundToQuarter } from './rounding'
import { endSessionAt, deleteSession, runningSession, startSession, stopSession } from './timer'
import { at, nextId, ok, year } from './test-utils'
import type { TrackingYear } from './types'

const D = '2026-09-29'

function clock(seconds: number): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(Math.floor(seconds / 3600))}:${p(Math.floor((seconds % 3600) / 60))}:${p(seconds % 60)}`
}

describe('roundToQuarter', () => {
  it('rounds to the nearest 15 minutes, halves up, never below zero', () => {
    expect(roundToQuarter(0)).toBe(0)
    expect(roundToQuarter(449)).toBe(0)
    expect(roundToQuarter(450)).toBe(15)
    expect(roundToQuarter(1349)).toBe(15)
    expect(roundToQuarter(1350)).toBe(30)
    expect(roundToQuarter(-300)).toBe(0)
    expect(roundToQuarter(-500)).toBe(0)
  })
})

describe('starting and stopping', () => {
  it('reports a session in quarter hours when it ends', () => {
    let y = ok(startSession(year(), at(D, '14:49:12'), 'Deck', nextId()))
    expect(runningSession(y)?.minutes).toBeUndefined()
    y = ok(stopSession(y, at(D, '15:10:40')))
    expect(y.sessions[0]).toMatchObject({ end: '15:10:40', minutes: 15 })
    expect(runningSession(y)).toBeNull()
  })

  it('switching stops the running task at the same instant, in one change', () => {
    let y = ok(startSession(year(), at(D, '09:00:00'), 'A', nextId()))
    y = ok(startSession(y, at(D, '10:00:00'), 'B', nextId()))
    expect(y.sessions).toHaveLength(2)
    expect(y.sessions[0]).toMatchObject({ label: 'A', end: '10:00:00', minutes: 60 })
    expect(y.sessions[1]).toMatchObject({ label: 'B', start: '10:00:00', end: null })
  })

  it('never has two running sessions, and restarting the running task changes nothing', () => {
    let y = ok(startSession(year(), at(D, '09:00:00'), 'A', nextId()))
    for (const [label, time] of [
      ['B', '09:10:00'],
      [' a ', '09:20:00'],
      ['C', '09:30:00'],
      ['B', '09:40:00']
    ])
      y = ok(startSession(y, at(D, time), label, nextId()))
    expect(y.sessions.filter((s) => s.end === null)).toHaveLength(1)
    const again = ok(
      startSession(y, at(D, '09:50:00'), runningSession(y)!.label.toUpperCase(), nextId())
    )
    expect(again).toBe(y)
  })

  it('refuses an empty name, a date outside the year, and a bad time', () => {
    expect(startSession(year(), at(D, '09:00:00'), '  ', 'x')).toEqual({
      ok: false,
      reason: 'empty-label'
    })
    expect(startSession(year(), at('2026-09-20', '09:00:00'), 'A', 'x')).toEqual({
      ok: false,
      reason: 'outside-year'
    })
    expect(startSession(year(), at('2027-09-20', '09:00:00'), 'A', 'x').ok).toBe(false)
    expect(startSession(year(), at(D, '25:00:00'), 'A', 'x')).toEqual({
      ok: false,
      reason: 'bad-time'
    })
  })

  it('stopping with nothing running changes nothing', () => {
    const y = year()
    expect(ok(stopSession(y, at(D, '09:00:00')))).toBe(y)
  })
})

describe('a session never crosses midnight', () => {
  const stale = (): TrackingYear =>
    ok(startSession(year(), at('2026-09-28', '14:49:12'), 'Late', 's1'))

  it('one left running overnight blocks starting and stopping until it has an end time', () => {
    const y = stale()
    expect(startSession(y, at(D, '09:00:00'), 'New', 'x')).toEqual({ ok: false, reason: 'stale' })
    expect(stopSession(y, at(D, '09:00:00'))).toEqual({ ok: false, reason: 'stale' })
  })

  it('counts only once it has an end, on its own day', () => {
    const y = ok(endSessionAt(stale(), 's1', '16:00:00'))
    expect(y.sessions[0]).toMatchObject({ date: '2026-09-28', end: '16:00:00', minutes: 75 })
    expect(runningSession(y)).toBeNull()
    expect(ok(startSession(y, at(D, '09:00:00'), 'New', 'x')).sessions).toHaveLength(2)
  })

  it('refuses an end before the start, and an end for a session that is not running', () => {
    expect(endSessionAt(stale(), 's1', '14:00:00')).toEqual({ ok: false, reason: 'before-start' })
    const done = ok(endSessionAt(stale(), 's1', '16:00:00'))
    expect(endSessionAt(done, 's1', '17:00:00')).toEqual({ ok: false, reason: 'not-running' })
    expect(endSessionAt(done, 'nope', '17:00:00').ok).toBe(false)
  })
})

describe('the rounding carry keeps the total true', () => {
  it('a 2-minute block shows 0:00 or 0:15 depending on where the carry stands', () => {
    let y = year()
    const reported: number[] = []
    for (let i = 0; i < 8; i++) {
      const s = 9 * 3600 + i * 600
      y = ok(startSession(y, at(D, clock(s)), 'Quick', nextId()))
      y = ok(stopSession(y, at(D, clock(s + 120))))
      reported.push(y.sessions[i].minutes!)
    }
    expect(reported).toEqual([0, 0, 0, 15, 0, 0, 0, 0])
    expect(carrySeconds(y)).toBe(8 * 120 - 15 * 60)
  })

  it('stays within 7½ minutes of the exact total however often the user switches', () => {
    // A fixed pseudo-random sequence: 20 days of many short blocks of 1 to 600 seconds, with gaps.
    let seed = 42
    const rand = (n: number): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed % n
    }
    let y = year()
    let exact = 0
    for (let day = 0; day < 20; day++) {
      const date = `2026-10-${String(day + 1).padStart(2, '0')}`
      let t = 8 * 3600
      for (let i = 0; i < 60; i++) {
        const len = 1 + rand(600)
        y = ok(startSession(y, at(date, clock(t)), `Task ${rand(4)}`, nextId()))
        y = ok(stopSession(y, at(date, clock(t + len))))
        exact += len
        t += len + rand(120)
      }
    }
    const reported = y.sessions.reduce((sum, s) => sum + reportedMinutes(s), 0) * 60
    expect(y.sessions.every((s) => s.minutes! % 15 === 0)).toBe(true)
    expect(Math.abs(reported - exact)).toBeLessThanOrEqual(450)
    expect(carrySeconds(y)).toBe(exact - reported)
    // Without a carry, rounding each block alone loses most of the time.
    const alone = y.sessions.reduce((sum, s) => sum + roundToQuarter(exactSeconds(s)) * 60, 0)
    expect(Math.abs(alone - exact)).toBeGreaterThan(450)
  })

  it('starts from the previous year’s final carry', () => {
    let y = year({ carryIn: 400 })
    y = ok(startSession(y, at(D, '09:00:00'), 'A', nextId()))
    y = ok(stopSession(y, at(D, '09:01:00')))
    // 400 + 60 = 460 s rounds up to 15 min; 460 − 900 is left over
    expect(y.sessions[0].minutes).toBe(15)
    expect(carrySeconds(y)).toBe(-440)
    expect(year({ carryIn: carrySeconds(y) }).carryIn).toBe(-440)
  })
})

describe('edits are truth: nothing already reported is ever re-derived', () => {
  it('deleting a session leaves every other session’s minutes as they were', () => {
    let y = year()
    for (let i = 0; i < 6; i++) {
      const s = 9 * 3600 + i * 600
      y = ok(startSession(y, at(D, clock(s)), 'Quick', `q${i}`))
      y = ok(stopSession(y, at(D, clock(s + 130))))
    }
    const before = y.sessions.map((s) => [s.id, s.minutes])
    const after = deleteSession(y, 'q2').sessions.map((s) => [s.id, s.minutes])
    expect(after).toEqual(before.filter(([id]) => id !== 'q2'))
  })
})
