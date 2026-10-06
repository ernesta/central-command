import { describe, expect, it } from 'vitest'
import { parsePlan, parseYear } from './parse'
import { emptyYear } from './types'

const good = (): Record<string, unknown> => JSON.parse(JSON.stringify(emptyYear('2026-09-21')))

describe('parseYear', () => {
  it('accepts what emptyYear writes, and fills missing parts', () => {
    expect(parseYear(good())).toEqual(emptyYear('2026-09-21'))
    expect(parseYear({ version: 1, start: '2026-09-21' })).toEqual(emptyYear('2026-09-21'))
  })

  it('refuses another version, a bad start and a wrong-shaped part', () => {
    expect(parseYear({ ...good(), version: 2 })).toBeNull()
    expect(parseYear({ ...good(), start: '2026-02-30' })).toBeNull()
    expect(parseYear({ ...good(), sessions: {} })).toBeNull()
    expect(parseYear({ ...good(), timeOff: [{ date: '2026-12-24', type: 'sick' }] })).toBeNull()
    expect(parseYear({ ...good(), days: { soon: { minutes: 1 } } })).toBeNull()
    expect(parseYear({ ...good(), carryIn: 'x' })).toBeNull()
    expect(parseYear(null)).toBeNull()
  })

  it('takes a year that starts on a Friday (Work) and a weekAim that is a boolean only', () => {
    expect(parseYear({ ...good(), start: '2026-09-25' })?.start).toBe('2026-09-25')
    const plan = { hoursPerWeek: 480, workDays: [1, 2, 3, 4, 5, 6, 7], allowanceDays: 0 }
    expect(parseYear({ ...good(), plan: { ...plan, weekAim: true } })?.plan.weekAim).toBe(true)
    expect(parseYear({ ...good(), plan: { ...plan, weekAim: 'yes' } })).toBeNull()
  })

  it('takes a contract name and an invoice of week or month, and refuses anything else', () => {
    const year = parseYear({ ...good(), name: 'Luminos', invoice: 'week' })
    expect(year?.name).toBe('Luminos')
    expect(year?.invoice).toBe('week')
    expect(parseYear({ ...good(), invoice: 'month' })?.invoice).toBe('month')
    expect(parseYear(good())?.name).toBeUndefined()
    expect(parseYear({ ...good(), invoice: 'year' })).toBeNull()
    expect(parseYear({ ...good(), invoice: 1 })).toBeNull()
    expect(parseYear({ ...good(), name: '' })).toBeNull()
    expect(parseYear({ ...good(), name: ' Luminos' })).toBeNull()
    expect(parseYear({ ...good(), name: 5 })).toBeNull()
  })

  it('reads a year with no fixed hours (0 a week) when it is aimed at by the week', () => {
    const plan = { hoursPerWeek: 0, workDays: [1, 2, 3, 4, 5, 6, 7], allowanceDays: 0 }
    expect(parseYear({ ...good(), plan: { ...plan, weekAim: true } })?.plan.hoursPerWeek).toBe(0)
    expect(parseYear({ ...good(), plan })).toBeNull()
  })

  it('keeps unknown keys, at the top and in entries', () => {
    const doc = {
      ...good(),
      extra: 1,
      sessions: [
        { id: 'a', date: '2026-09-29', start: '10:00:00', end: null, label: 'x', colour: 'red' }
      ]
    }
    const year = parseYear(doc) as unknown as Record<string, unknown>
    expect(year.extra).toBe(1)
    expect((year.sessions as Record<string, unknown>[])[0].colour).toBe('red')
  })
})

describe('parsePlan', () => {
  it('sorts the days and rejects out-of-range values', () => {
    expect(
      parsePlan({ hoursPerWeek: 480, workDays: [3, 1, 3], allowanceDays: 0 })?.workDays
    ).toEqual([1, 3])
    expect(parsePlan({ hoursPerWeek: 0, workDays: [1], allowanceDays: 1 })).toBeNull()
    expect(
      parsePlan({ hoursPerWeek: -15, workDays: [1], allowanceDays: 1, weekAim: true })
    ).toBeNull()
    expect(
      parsePlan({ hoursPerWeek: 0, workDays: [1], allowanceDays: 0, weekAim: true })
    ).not.toBeNull()
    expect(parsePlan({ hoursPerWeek: 480, workDays: [8], allowanceDays: 1 })).toBeNull()
    expect(parsePlan({ hoursPerWeek: 480, workDays: [], allowanceDays: 1 })).toBeNull()
    expect(parsePlan({ hoursPerWeek: 480, workDays: [1], allowanceDays: 1.5 })).toBeNull()
  })
})
