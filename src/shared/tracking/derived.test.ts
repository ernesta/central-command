import { describe, expect, it } from 'vitest'
import { derivedRows, withDerived, type DerivedEntry } from './derived'
import { carrySeconds } from './rounding'
import { addTime, dayMinutes, dayRows, minutesByClient, weekMinutes } from './totals'
import { nextId, ok, year } from './test-utils'
import type { Adjust, TrackingYear } from './types'

const entry = (over: Partial<DerivedEntry> = {}): DerivedEntry => ({
  id: '2026-09-24 Supervision',
  date: '2026-09-24',
  start: '14:00',
  end: '15:00',
  task: 'cc://task/abc12345',
  label: 'Supervision',
  ...over
})

describe('withDerived', () => {
  it('adds the meeting to the day, the week and the total, and changes nothing stored', () => {
    const base = year()
    const shown = withDerived(base, [entry()])
    expect(dayMinutes(shown, '2026-09-24')).toBe(60)
    expect(weekMinutes(shown, '2026-09-21')).toBe(60)
    expect(base.sessions).toEqual([])
    expect(shown).not.toBe(base)
  })

  it('keeps meeting lines out of the editable task rows', () => {
    const shown = withDerived(year(), [entry()])
    expect(dayRows(shown, '2026-09-24')).toEqual([])
    expect(derivedRows(shown, '2026-09-24')).toEqual([
      {
        kind: 'meeting',
        id: '2026-09-24 Supervision',
        label: 'Supervision',
        task: 'cc://task/abc12345',
        start: '14:00',
        end: '15:00',
        minutes: 60
      }
    ])
  })

  it('adds nothing when imported history linked to the task already holds that day', () => {
    const task = 'cc://task/abc12345'
    const adjust = {
      id: 'a1',
      date: '2026-09-24',
      label: 'Supervision',
      minutes: 60,
      task,
      earlier: true as const
    }
    const base = { ...year(), adjusts: [adjust] }
    expect(dayMinutes(withDerived(base, [entry()]), '2026-09-24')).toBe(60)
    const session = {
      id: 's1',
      date: '2026-09-24',
      start: '14:00:00',
      end: '15:00:00',
      label: 'x',
      task,
      earlier: true as const
    }
    expect(
      dayMinutes(withDerived({ ...year(), sessions: [session] }, [entry()]), '2026-09-24')
    ).toBe(dayMinutes({ ...year(), sessions: [session] }, '2026-09-24'))
  })

  it('still adds the meeting when the history is another day, another task or not marked earlier', () => {
    const task = 'cc://task/abc12345'
    const adj = (over: object): Adjust => ({
      id: 'a1',
      date: '2026-09-24',
      label: 'S',
      minutes: 15,
      task,
      earlier: true as const,
      ...over
    })
    for (const over of [
      { date: '2026-09-23' },
      { task: 'cc://task/zzz99999' },
      { earlier: undefined }
    ]) {
      const shown = withDerived({ ...year(), adjusts: [adj(over)] }, [entry()])
      expect(shown.sessions).toHaveLength(1)
    }
  })

  it('still adds the meeting when the same-day session on the task is not marked earlier', () => {
    const session = {
      id: 's1',
      date: '2026-09-24',
      start: '09:00:00',
      end: '09:30:00',
      label: 'x',
      task: 'cc://task/abc12345'
    }
    const shown = withDerived({ ...year(), sessions: [session] }, [entry()])
    expect(shown.sessions).toHaveLength(2)
  })

  it('does not mix with the user own time on the same task', () => {
    const base = ok(addTime(year(), '2026-09-24', 'Supervision', 30, nextId()))
    const shown = withDerived(base, [entry()])
    expect(dayRows(shown, '2026-09-24').map((r) => r.minutes)).toEqual([30])
    expect(dayMinutes(shown, '2026-09-24')).toBe(90)
  })

  it('reports a length that is not a quarter hour to the quarter, without touching the carry of real sessions', () => {
    const base: TrackingYear = year({ carryIn: 120 })
    const shown = withDerived(base, [entry({ start: '14:00', end: '14:50' })])
    expect(dayMinutes(shown, '2026-09-24')).toBe(45)
    expect(carrySeconds(shown)).toBe(carrySeconds(base))
  })

  it('leaves out a day outside the year', () => {
    const shown = withDerived(year(), [
      entry({ date: '2027-09-24' }),
      entry({ date: '2026-09-20' })
    ])
    expect(shown.sessions).toEqual([])
  })

  it('in Work puts a meeting only where its client is, in the plan spelling, and drops one with no client', () => {
    const work = year({ plan: { ...year().plan, clients: ['Impact', 'Teaching & Learning'] } })
    const shown = withDerived(work, [
      entry({ id: 'a', client: 'impact' }),
      entry({ id: 'b', client: 'Somebody Else', start: '16:00', end: '17:00' }),
      entry({ id: 'c', start: '18:00', end: '19:00' })
    ])
    expect(shown.sessions.map((s) => [s.id, s.client])).toEqual([['meeting:a', 'Impact']])
    expect(minutesByClient(shown, '2026-09-21', '2026-09-27')).toEqual([
      { client: 'Impact', minutes: 60 }
    ])
  })

  it('lists lines earliest first', () => {
    const shown = withDerived(year(), [
      entry({ id: 'late', start: '16:00', end: '17:00' }),
      entry({ id: 'early', start: '09:00', end: '09:30' })
    ])
    expect(derivedRows(shown, '2026-09-24').map((r) => r.id)).toEqual(['early', 'late'])
  })
})

describe('a lecture next to a meeting', () => {
  it('keeps its kind, so a row links to the right note, and counts like any other block', () => {
    const shown = withDerived(year(), [
      entry({ kind: 'training', id: 'same', start: '10:00', end: '11:30', label: 'Plotly' }),
      entry({ id: 'same', start: '14:00', end: '15:00' })
    ])
    expect(derivedRows(shown, '2026-09-24').map((r) => [r.kind, r.id, r.minutes])).toEqual([
      ['training', 'same', 90],
      ['meeting', 'same', 60]
    ])
    expect(dayMinutes(shown, '2026-09-24')).toBe(150)
    expect(new Set(shown.sessions.map((s) => s.id)).size).toBe(2)
  })
})
