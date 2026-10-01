import { describe, expect, it } from 'vitest'
import {
  addTime,
  dayMinutes,
  dayRows,
  minutesByDate,
  setDayNote,
  setTaskMinutes,
  weekMinutes,
  yearMinutes
} from './totals'
import { startSession, stopSession } from './timer'
import { at, nextId, ok, year } from './test-utils'
import type { TrackingYear } from './types'

const D = '2026-09-29'

/** Work on tasks as the timer would: [label, start, end] on one date. */
function worked(date: string, blocks: [string, string, string][]): TrackingYear {
  let y = year()
  for (const [label, from, to] of blocks) {
    y = ok(startSession(y, at(date, from), label, nextId()))
    y = ok(stopSession(y, at(date, to)))
  }
  return y
}

describe('a day shows one row per task', () => {
  it('merges the same task ignoring case and spaces, first spelling wins, in the order first used', () => {
    const y = worked(D, [
      ['Deck', '09:00:00', '09:30:00'],
      ['Email', '09:30:00', '09:45:00'],
      [' deck ', '09:45:00', '10:15:00'],
      ['EMAIL', '10:15:00', '10:30:00']
    ])
    expect(dayRows(y, D)).toMatchObject([
      { label: 'Deck', minutes: 60, running: false },
      { label: 'Email', minutes: 30, running: false }
    ])
  })

  it('keeps the order while switching back and forth, and marks the running one', () => {
    let y = worked(D, [
      ['A', '09:00:00', '09:30:00'],
      ['B', '09:30:00', '10:00:00']
    ])
    y = ok(startSession(y, at(D, '10:00:00'), 'A', nextId()))
    const rows = dayRows(y, D, at(D, '10:20:00'))
    expect(rows.map((r) => r.label)).toEqual(['A', 'B'])
    expect(rows[0]).toMatchObject({ running: true, minutes: 30 + 15 })
    expect(rows[1].running).toBe(false)
  })

  it('shows what a running session would report now, without storing it', () => {
    const y = ok(startSession(year(), at(D, '09:00:00'), 'A', nextId()))
    expect(dayRows(y, D, at(D, '09:06:00'))[0].minutes).toBe(0)
    expect(dayRows(y, D, at(D, '09:08:00'))[0].minutes).toBe(15)
    expect(dayMinutes(y, D)).toBe(0)
    expect(y.sessions[0].minutes).toBeUndefined()
  })

  it('leaves out a task at 0:00 that is not running, and other days', () => {
    const y = worked(D, [['Blip', '09:00:00', '09:01:00']])
    expect(dayRows(y, D)).toEqual([])
    expect(dayRows(y, '2026-09-30')).toEqual([])
    expect(dayRows(y, '2020-01-01')).toEqual([])
  })
})

describe('totals are sums of reported time', () => {
  it('adds sessions, typed time and imported day totals, only inside the year', () => {
    let y = worked(D, [['A', '09:00:00', '10:00:00']])
    y = ok(addTime(y, D, 'B', 30, nextId()))
    y = { ...y, days: { '2026-09-28': { minutes: 465 }, '2020-01-01': { minutes: 999 } } }
    expect(dayMinutes(y, D)).toBe(90)
    expect(dayMinutes(y, '2026-09-28')).toBe(465)
    expect(weekMinutes(y, '2026-09-28')).toBe(465 + 90)
    expect(yearMinutes(y)).toBe(465 + 90)
    expect(yearMinutes(y, '2026-09-28')).toBe(465)
    expect(minutesByDate(y).has('2020-01-01')).toBe(false)
  })
})

describe('editing a task’s time for a day', () => {
  it('shows exactly what was typed, and later timer time adds on top', () => {
    let y = worked(D, [['Deck', '09:00:00', '10:00:00']])
    y = ok(setTaskMinutes(y, D, 'deck', 90, nextId()))
    expect(dayRows(y, D)[0].minutes).toBe(90)
    expect(y.adjusts).toHaveLength(1)
    expect(y.adjusts[0].minutes).toBe(30)
    y = ok(startSession(y, at(D, '11:00:00'), 'Deck', nextId()))
    y = ok(stopSession(y, at(D, '11:30:00')))
    expect(dayRows(y, D)[0].minutes).toBe(120)
  })

  it('editing again replaces rather than stacks, and typing the timer’s own time removes the adjustment', () => {
    let y = worked(D, [['Deck', '09:00:00', '10:00:00']])
    y = ok(setTaskMinutes(y, D, 'Deck', 90, nextId()))
    y = ok(setTaskMinutes(y, D, 'Deck', 45, nextId()))
    expect(y.adjusts).toHaveLength(1)
    expect(dayRows(y, D)[0].minutes).toBe(45)
    y = ok(setTaskMinutes(y, D, 'Deck', 60, nextId()))
    expect(y.adjusts).toHaveLength(0)
  })

  it('setting 0:00 removes the row', () => {
    let y = worked(D, [['Deck', '09:00:00', '10:00:00']])
    y = ok(setTaskMinutes(y, D, 'Deck', 0, nextId()))
    expect(dayRows(y, D)).toEqual([])
    expect(dayMinutes(y, D)).toBe(0)
  })

  it('never moves another task, another day, or any frozen session', () => {
    let y = worked(D, [
      ['A', '09:00:00', '09:02:00'],
      ['B', '09:10:00', '09:12:00'],
      ['A', '09:20:00', '09:22:00'],
      ['B', '09:30:00', '09:32:00'],
      ['A', '09:40:00', '09:42:00']
    ])
    y = { ...y, days: { '2026-09-28': { minutes: 465 } } }
    const frozen = JSON.stringify(y.sessions)
    const other = dayMinutes(y, '2026-09-28')
    const b = dayRows(y, D).find((r) => r.label === 'B')!.minutes
    y = ok(setTaskMinutes(y, D, 'A', 120, nextId()))
    expect(JSON.stringify(y.sessions)).toBe(frozen)
    expect(dayMinutes(y, '2026-09-28')).toBe(other)
    expect(dayRows(y, D).find((r) => r.label === 'B')!.minutes).toBe(b)
    expect(dayRows(y, D).find((r) => r.label === 'A')!.minutes).toBe(120)
  })

  it('keeps other tasks’ typed time on the same day', () => {
    let y = worked(D, [['A', '09:00:00', '10:00:00']])
    y = ok(addTime(y, D, 'B', 30, nextId()))
    y = ok(setTaskMinutes(y, D, 'A', 75, nextId()))
    expect(dayRows(y, D).map((r) => [r.label, r.minutes])).toEqual([
      ['A', 75],
      ['B', 30]
    ])
  })

  it('refuses a time that is not a quarter hour, is negative, or a date or name that does not fit', () => {
    const y = year()
    expect(setTaskMinutes(y, D, 'A', 20, 'x').ok).toBe(false)
    expect(setTaskMinutes(y, D, 'A', -15, 'x').ok).toBe(false)
    expect(setTaskMinutes(y, D, ' ', 15, 'x').ok).toBe(false)
    expect(setTaskMinutes(y, '2026-09-20', 'A', 15, 'x')).toEqual({
      ok: false,
      reason: 'outside-year'
    })
  })

  it('Add takes positive quarter hours for any task and any day in the year', () => {
    const y = year()
    expect(addTime(y, D, 'Forgot', 0, 'x').ok).toBe(false)
    expect(addTime(y, D, 'Forgot', 10, 'x').ok).toBe(false)
    expect(addTime(y, '2027-09-20', 'Forgot', 15, 'x').ok).toBe(false)
    expect(dayRows(ok(addTime(y, D, 'Forgot', 45, 'x')), D)).toMatchObject([
      { label: 'Forgot', minutes: 45 }
    ])
  })
})

describe('day notes', () => {
  it('sets, replaces and removes a note without touching the day’s time', () => {
    let y = year({ days: { [D]: { minutes: 465 } } })
    y = ok(setDayNote(y, D, ' look at inkpath '))
    expect(y.days[D]).toEqual({ minutes: 465, note: 'look at inkpath' })
    y = ok(setDayNote(y, D, ''))
    expect(y.days[D]).toEqual({ minutes: 465 })
    y = ok(setDayNote(year(), D, 'x'))
    expect(ok(setDayNote(y, D, '')).days).toEqual({})
    expect(setDayNote(y, '2020-01-01', 'x').ok).toBe(false)
  })
})
