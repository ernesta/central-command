import { describe, expect, it } from 'vitest'
import {
  carrySeconds,
  exactSeconds,
  provisionalMinutes,
  reportedMinutes,
  roundToQuarter
} from './rounding'
import {
  assignTask,
  endFinishedDay,
  endSessionAt,
  deleteSession,
  renameTask,
  relabelTask,
  overlapsFor,
  runningSession,
  setStartAt,
  startSession,
  stopSession
} from './timer'
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

  it('starts without a name, and renaming gives it one', () => {
    const started = ok(startSession(year(), at(D, '09:00:00'), '  ', 'x'))
    expect(runningSession(started)?.label).toBe('')
    expect(runningSession(ok(startSession(started, at(D, '09:05:00'), '', 'y')))?.id).toBe('x')
    const named = ok(renameTask(started, D, '', ' Reading '))
    expect(runningSession(named)?.label).toBe('Reading')
  })

  it('renames one day only, keeps frozen minutes, and refuses an empty name', () => {
    let y = ok(startSession(year(), at(D, '09:00:00'), 'Mail', 'a'))
    y = ok(stopSession(y, at(D, '09:20:00')))
    y = ok(startSession(y, at('2026-09-30', '09:00:00'), 'mail', 'b'))
    y = ok(stopSession(y, at('2026-09-30', '09:10:00')))
    const before = y.sessions.find((s) => s.id === 'a')!.minutes
    const renamed = ok(renameTask(y, D, 'MAIL', 'Email'))
    expect(renamed.sessions.map((s) => s.label)).toEqual(['Email', 'mail'])
    expect(renamed.sessions[0].minutes).toBe(before)
    expect(renameTask(y, D, 'Mail', '  ')).toEqual({ ok: false, reason: 'empty-label' })
  })

  it('refuses a date outside the year, and a bad time', () => {
    expect(startSession(year(), at('2026-09-20', '09:00:00'), 'A', 'x')).toEqual({
      ok: false,
      reason: 'outside-year'
    })
    expect(startSession(year(), at('2027-09-20', '09:00:00'), 'A', 'x').ok).toBe(false)
    expect(startSession(year(), at(D, '28:00:00'), 'A', 'x')).toEqual({
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

describe('the running row', () => {
  it('shows the exact time it has run; the carry and rounding come when it ends', () => {
    // A 10-minute block reports 0:15 and leaves a carry of -5 min.
    let y = ok(startSession(year(), at(D, '09:00:00'), 'A', 'a'))
    y = ok(stopSession(y, at(D, '09:10:00')))
    y = ok(startSession(y, at(D, '09:10:00'), 'B', 'b'))
    const b = runningSession(y)!
    expect(provisionalMinutes(b, '09:10:00')).toBe(0)
    expect(provisionalMinutes(b, '09:14:30')).toBe(4)
    // Stopped after 4 minutes: -5 + 4 rounds to 0:00, and the carry moves to -1.
    const stopped = ok(stopSession(y, at(D, '09:14:00')))
    expect(stopped.sessions[1].minutes).toBe(0)
    expect(carrySeconds(stopped)).toBe(-5 * 60 + 4 * 60)
  })

  it('ends a timer at the day end once the day is over, and not before', () => {
    const y = ok(startSession(year(), at(D, '23:00:00'), 'A', 'a'))
    expect(endFinishedDay(y, at(D, '27:59:59'))).toEqual({ ok: true, year: y })
    const ended = ok(endFinishedDay(y, at('2026-09-30', '04:00:00')))
    expect(ended.sessions[0]).toMatchObject({ end: '27:59:59', minutes: 300 })
  })

  it('lets a timer run past midnight into the small hours of the same day', () => {
    let y = ok(startSession(year(), at(D, '23:30:00'), 'A', 'a'))
    y = ok(stopSession(y, at(D, '25:30:00')))
    expect(y.sessions[0]).toMatchObject({ end: '25:30:00', minutes: 120 })
  })
})

describe('starting earlier than now', () => {
  /** A 09:00-10:00 entry, then a timer started at 10:30 and checked at 10:45. */
  function running(): { y: TrackingYear; id: string } {
    let y = ok(startSession(year(), at(D, '09:00:00'), 'A', nextId()))
    y = ok(stopSession(y, at(D, '10:00:00')))
    y = ok(startSession(y, at(D, '10:30:00'), 'B', nextId()))
    return { y, id: runningSession(y)!.id }
  }

  it('moves the start back into a gap and leaves the earlier entry alone', () => {
    const { y, id } = running()
    const moved = ok(setStartAt(y, id, '10:15:00', at(D, '10:45:00')))
    expect(runningSession(moved)?.start).toBe('10:15:00')
    expect(moved.sessions[0]).toMatchObject({ end: '10:00:00', minutes: 60 })
  })

  it('trims the end of an earlier entry it overlaps and reports its minutes again', () => {
    const { y, id } = running()
    const moved = ok(setStartAt(y, id, '09:30:00', at(D, '10:45:00')))
    expect(moved.sessions[0]).toMatchObject({ start: '09:00:00', end: '09:30:00', minutes: 30 })
    expect(runningSession(moved)?.start).toBe('09:30:00')
  })

  it('keeps the carry adding up after a trim', () => {
    let y = ok(startSession(year(), at(D, '09:00:00'), 'A', nextId()))
    y = ok(stopSession(y, at(D, '09:50:00'))) // 50 min exact -> 45 reported, 5 carried
    y = ok(startSession(y, at(D, '10:00:00'), 'B', nextId()))
    const id = runningSession(y)!.id
    const moved = ok(setStartAt(y, id, '09:40:00', at(D, '10:30:00')))
    const first = moved.sessions[0]
    expect(first).toMatchObject({ end: '09:40:00', minutes: 45 })
    // carry = exact - reported, nothing lost or invented
    expect(carrySeconds(moved)).toBe(exactSeconds(first) - first.minutes! * 60)
  })

  it('refuses a start that would swallow an earlier entry, and changes nothing', () => {
    const { y, id } = running()
    const result = setStartAt(y, id, '08:30:00', at(D, '10:45:00'))
    expect(result).toEqual({ ok: false, reason: 'covers-entry' })
    expect(overlapsFor(y, runningSession(y)!, '08:30:00').swallowed).toHaveLength(1)
  })

  it('treats an entry ending exactly where the timer starts as no overlap', () => {
    const { y } = running()
    expect(overlapsFor(y, runningSession(y)!, '10:00:00')).toEqual({ trimmed: [], swallowed: [] })
  })

  it('refuses a start after now, a bad time, a stopped session and one from an earlier day', () => {
    const { y, id } = running()
    expect(setStartAt(y, id, '11:00:00', at(D, '10:45:00'))).toEqual({
      ok: false,
      reason: 'in-future'
    })
    expect(setStartAt(y, id, 'nope', at(D, '10:45:00'))).toEqual({ ok: false, reason: 'bad-time' })
    expect(setStartAt(y, id, '25:00:00', at(D, '26:00:00'))).toEqual({
      ok: false,
      reason: 'bad-time'
    })
    expect(setStartAt(y, y.sessions[0].id, '09:00:00', at(D, '10:45:00'))).toEqual({
      ok: false,
      reason: 'not-running'
    })
    expect(setStartAt(y, id, '10:00:00', at('2026-09-30', '09:00:00'))).toEqual({
      ok: false,
      reason: 'stale'
    })
  })

  it('moves the start later too, up to now', () => {
    const { y, id } = running()
    expect(ok(setStartAt(y, id, '10:45:00', at(D, '10:45:00'))).sessions[1].start).toBe('10:45:00')
  })
})

describe('assignTask', () => {
  const running = (extra: Partial<TrackingYear> = {}): TrackingYear =>
    ok(startSession(year(extra), at(D, '09:00:00'), '', 'r1'))

  it('gives the running timer its name and task, keeping its start', () => {
    const y = ok(assignTask(running(), 'r1', ' Deck ', 'cc://task/a'))
    expect(y.sessions[0]).toMatchObject({
      label: 'Deck',
      task: 'cc://task/a',
      start: '09:00:00',
      end: null
    })
  })

  it("takes the task's client, and keeps the timer's own when none is given", () => {
    const plan = { hoursPerWeek: 0, workDays: [1], allowanceDays: 0, clients: ['A', 'B'] }
    const y = running({ plan })
    expect(ok(assignTask(y, 'r1', 'x', 'cc://task/a', 'B')).sessions[0].client).toBe('B')
    const kept = ok(assignTask(y, 'r1', 'x', 'cc://task/a')).sessions[0].client
    expect(kept).toBe('A')
  })

  it('refuses a client that is not on the plan, a stopped session and an empty name', () => {
    const plan = { hoursPerWeek: 0, workDays: [1], allowanceDays: 0, clients: ['A'] }
    expect(assignTask(running({ plan }), 'r1', 'x', 'cc://task/a', 'Z')).toEqual({
      ok: false,
      reason: 'bad-client'
    })
    const stopped = ok(stopSession(running(), at(D, '10:00:00')))
    expect(assignTask(stopped, 'r1', 'x', 'cc://task/a')).toEqual({
      ok: false,
      reason: 'not-running'
    })
    expect(assignTask(running(), 'r1', '  ', 'cc://task/a')).toEqual({
      ok: false,
      reason: 'empty-label'
    })
  })

  it('changes nothing but the running session', () => {
    let y = ok(startSession(year(), at(D, '08:00:00'), 'Earlier', 'e1'))
    y = ok(startSession(y, at(D, '09:00:00'), '', 'r1'))
    const after = ok(assignTask(y, 'r1', 'Deck', 'cc://task/a'))
    expect(after.sessions[0]).toEqual(y.sessions[0])
  })
})

describe('relabelTask', () => {
  it('gives every entry on the task the new label, on every day, and nothing else', () => {
    let y = ok(startSession(year(), at(D, '09:00:00'), 'Old', nextId(), 'cc://task/a'))
    y = ok(stopSession(y, at(D, '10:00:00')))
    y = ok(startSession(y, at('2026-09-30', '09:00:00'), 'Old', nextId(), 'cc://task/a'))
    y = ok(stopSession(y, at('2026-09-30', '10:00:00')))
    y = ok(startSession(y, at(D, '11:00:00'), 'Old', nextId(), 'cc://task/b'))
    const next = relabelTask(y, 'cc://task/a', ' New ')
    expect(next.sessions.map((s) => s.label)).toEqual(['New', 'New', 'Old'])
    expect(next.sessions[0].minutes).toBe(y.sessions[0].minutes)
  })

  it('returns the same year when nothing changes', () => {
    const y = ok(startSession(year(), at(D, '09:00:00'), 'New', nextId(), 'cc://task/a'))
    expect(relabelTask(y, 'cc://task/a', 'New')).toBe(y)
    expect(relabelTask(y, 'cc://task/a', '  ')).toBe(y)
  })
})
