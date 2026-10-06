import { describe, expect, it } from 'vitest'
import { parsePlan, parseYear } from './parse'
import { at, nextId, ok, year } from './test-utils'
import {
  defaultClient,
  renameTask,
  resolveClient,
  runningSession,
  setClient,
  startSession,
  stopSession
} from './timer'
import { addTime, dayRows, minutesByClient, setTaskMinutes } from './totals'
import { DEFAULT_PLAN, WORK_PLAN, emptyYear, type TrackingYear } from './types'

const D = '2026-09-29'
const work = (): TrackingYear => ({ ...emptyYear('2026-09-25', WORK_PLAN), weeks: 4 })
const WD = '2026-09-29'

describe('which client an entry gets', () => {
  it('has none where the plan has no clients, whatever was asked', () => {
    const y = ok(startSession(year(), at(D, '09:00:00'), 'a', nextId(), undefined, 'Impact'))
    expect(runningSession(y)?.client).toBeUndefined()
    expect(defaultClient(year())).toBeUndefined()
  })

  it('defaults to the first client, then to the client of the latest entry', () => {
    let y = work()
    expect(defaultClient(y)).toBe('Impact')
    y = ok(addTime(y, WD, 'a', 60, nextId(), 'Teaching & Learning'))
    expect(defaultClient(y)).toBe('Teaching & Learning')
    y = ok(addTime(y, '2026-09-26', 'earlier', 60, nextId(), 'Impact'))
    expect(defaultClient(y)).toBe('Teaching & Learning')
    y = ok(addTime(y, '2026-09-30', 'later', 60, nextId()))
    expect(y.adjusts.at(-1)?.client).toBe('Teaching & Learning')
  })

  it('refuses a name that is not on the list', () => {
    const y = work()
    expect(resolveClient(y, 'Luminos')).toEqual({ ok: false, reason: 'bad-client' })
    expect(startSession(y, at(WD, '09:00:00'), 'a', nextId(), undefined, 'Luminos')).toEqual({
      ok: false,
      reason: 'bad-client'
    })
    expect(addTime(y, WD, 'a', 60, nextId(), 'impact')).toEqual({
      ok: false,
      reason: 'bad-client'
    })
  })
})

describe('the timer carries the client', () => {
  it('records it on the session and keeps the same label for two clients apart', () => {
    let y = ok(startSession(work(), at(WD, '09:00:00'), 'Meetings', nextId(), undefined, 'Impact'))
    // The same label and client is the same task: nothing changes.
    expect(startSession(y, at(WD, '09:10:00'), 'meetings', nextId(), undefined, 'Impact')).toEqual({
      ok: true,
      year: y
    })
    // Another client is another task: the first stops.
    y = ok(
      startSession(y, at(WD, '10:00:00'), 'Meetings', nextId(), undefined, 'Teaching & Learning')
    )
    expect(y.sessions.map((s) => [s.client, s.end !== null])).toEqual([
      ['Impact', true],
      ['Teaching & Learning', false]
    ])
    y = ok(stopSession(y, at(WD, '11:00:00')))
    const rows = dayRows(y, WD)
    expect(rows.map((r) => [r.label, r.client, r.minutes])).toEqual([
      ['Meetings', 'Impact', 60],
      ['Meetings', 'Teaching & Learning', 60]
    ])
  })
})

describe('rows are a label and a client', () => {
  const two = (): TrackingYear => {
    let y = work()
    y = ok(addTime(y, WD, 'Meetings', 60, nextId(), 'Impact'))
    y = ok(addTime(y, WD, 'Meetings', 30, nextId(), 'Teaching & Learning'))
    return y
  }

  it('sets the time of one row without touching the other client', () => {
    const y = ok(setTaskMinutes(two(), WD, 'Meetings', 150, nextId(), 'Impact'))
    expect(dayRows(y, WD).map((r) => [r.client, r.minutes])).toEqual([
      ['Impact', 150],
      ['Teaching & Learning', 30]
    ])
    expect(y.adjusts.every((a) => a.client !== undefined)).toBe(true)
  })

  it('renames one row only', () => {
    const y = ok(renameTask(two(), WD, 'Meetings', 'Calls', 'Impact'))
    expect(dayRows(y, WD).map((r) => [r.label, r.client])).toEqual([
      ['Calls', 'Impact'],
      ['Meetings', 'Teaching & Learning']
    ])
  })

  it('changes the client of a row, merging it into a row of the same name', () => {
    const y = ok(setClient(two(), WD, 'Meetings', 'Impact', 'Teaching & Learning'))
    expect(dayRows(y, WD).map((r) => [r.client, r.minutes])).toEqual([['Teaching & Learning', 90]])
    expect(setClient(two(), WD, 'Meetings', 'Impact', 'Luminos')).toEqual({
      ok: false,
      reason: 'bad-client'
    })
    expect(setClient(two(), '2026-12-31', 'Meetings', 'Impact', 'Impact').ok).toBe(false)
  })

  it('keeps older time without a client as its own row', () => {
    let y = work()
    y = { ...y, adjusts: [{ id: 'x', date: WD, label: 'Old', minutes: 45 }] }
    y = ok(setTaskMinutes(y, WD, 'Old', 60, nextId()))
    expect(dayRows(y, WD).map((r) => [r.client, r.minutes])).toEqual([[undefined, 60]])
  })
})

describe('minutesByClient', () => {
  it('sums sessions and typed time per client, in the plan order, inside the days given', () => {
    let y = work()
    y = ok(addTime(y, '2026-09-26', 'a', 60, nextId(), 'Teaching & Learning'))
    y = ok(addTime(y, '2026-09-27', 'b', 120, nextId(), 'Impact'))
    y = ok(addTime(y, '2026-09-28', 'c', 15, nextId(), 'Teaching & Learning'))
    y = ok(startSession(y, at('2026-09-29', '09:00:00'), 'd', nextId(), undefined, 'Impact'))
    y = ok(stopSession(y, at('2026-09-29', '09:30:00')))
    expect(minutesByClient(y, '2026-09-25', '2026-10-22')).toEqual([
      { client: 'Impact', minutes: 150 },
      { client: 'Teaching & Learning', minutes: 75 }
    ])
    expect(minutesByClient(y, '2026-09-28', '2026-09-28')).toEqual([
      { client: 'Teaching & Learning', minutes: 15 }
    ])
  })

  it('puts time with no client last, and omits clients with no time', () => {
    let y = work()
    y = { ...y, adjusts: [{ id: 'x', date: WD, label: 'Old', minutes: 45 }] }
    y = { ...y, days: { '2026-09-26': { minutes: 30 } } }
    y = ok(addTime(y, WD, 'b', 60, nextId(), 'Teaching & Learning'))
    expect(minutesByClient(y, '2026-09-25', '2026-10-22')).toEqual([
      { client: 'Teaching & Learning', minutes: 60 },
      { client: null, minutes: 75 }
    ])
  })

  it('counts Research time as one group with no client', () => {
    const y = ok(addTime(year(), D, 'a', 60, nextId()))
    expect(minutesByClient(y, '2026-09-21', '2026-12-31')).toEqual([{ client: null, minutes: 60 }])
  })
})

describe('the file format', () => {
  it('keeps a client on sessions, adjusts and the plan through a read', () => {
    let y = ok(startSession(work(), at(WD, '09:00:00'), 'a', nextId(), undefined, 'Impact'))
    y = ok(stopSession(y, at(WD, '10:00:00')))
    y = ok(addTime(y, WD, 'b', 30, nextId(), 'Teaching & Learning'))
    const back = parseYear(JSON.parse(JSON.stringify(y)))
    expect(back?.sessions[0].client).toBe('Impact')
    expect(back?.adjusts[0].client).toBe('Teaching & Learning')
    expect(back?.plan.clients).toEqual(['Impact', 'Teaching & Learning'])
  })

  it('refuses a client that is not text, and a bad client list', () => {
    const y = ok(addTime(work(), WD, 'b', 30, nextId(), 'Impact'))
    const raw = JSON.parse(JSON.stringify(y))
    raw.adjusts[0].client = 5
    expect(parseYear(raw)).toBeNull()
    const timed = ok(startSession(work(), at(WD, '09:00:00'), 'a', nextId(), undefined, 'Impact'))
    const rawSession = JSON.parse(JSON.stringify(timed))
    rawSession.sessions[0].client = 5
    expect(parseYear(rawSession)).toBeNull()
    const base = { hoursPerWeek: 480, workDays: [1], allowanceDays: 0 }
    expect(parsePlan({ ...base, clients: ['A', 'B'] })?.clients).toEqual(['A', 'B'])
    expect(parsePlan({ ...base, clients: ['A', 'a'] })).toBeNull()
    expect(parsePlan({ ...base, clients: [''] })).toBeNull()
    expect(parsePlan({ ...base, clients: [' A'] })).toBeNull()
    expect(parsePlan({ ...base, clients: 'A' })).toBeNull()
  })

  it('gives Work the two clients and Research none', () => {
    expect(WORK_PLAN.clients).toEqual(['Impact', 'Teaching & Learning'])
    expect(DEFAULT_PLAN.clients).toBeUndefined()
    expect(emptyYear('2026-09-21').plan.clients).toBeUndefined()
  })
})

describe('imported history linked to a task', () => {
  const linked = (): TrackingYear => ({
    ...work(),
    adjusts: [
      {
        id: 'h1',
        date: WD,
        label: 'Meeting',
        minutes: 60,
        client: 'Impact',
        task: 'cc://task/t',
        earlier: true
      },
      {
        id: 'h2',
        date: WD,
        label: 'Meeting',
        minutes: 30,
        client: 'Impact',
        task: 'cc://task/t',
        earlier: true
      }
    ]
  })

  it('is read and written back with its flag, and a flag that is not true is refused', () => {
    const y = linked()
    expect(parseYear(JSON.parse(JSON.stringify(y)))?.adjusts[0].earlier).toBe(true)
    const bad = JSON.parse(JSON.stringify(y))
    bad.adjusts[0].earlier = false
    expect(parseYear(bad)).toBeNull()
  })

  it('is never replaced when the row is retyped: the typed total includes it', () => {
    const y = ok(setTaskMinutes(linked(), WD, 'Meeting', 120, nextId(), 'Impact'))
    expect(dayRows(y, WD)[0].minutes).toBe(120)
    expect(y.adjusts.filter((a) => a.earlier).map((a) => a.minutes)).toEqual([60, 30])
    expect(y.adjusts.filter((a) => !a.earlier)).toMatchObject([
      { minutes: 30, task: 'cc://task/t' }
    ])
  })

  it('leaves the history alone when the row is retyped to exactly its total', () => {
    const y = ok(setTaskMinutes(linked(), WD, 'Meeting', 90, nextId(), 'Impact'))
    expect(y.adjusts).toHaveLength(2)
    expect(y.adjusts.every((a) => a.earlier)).toBe(true)
  })
})
