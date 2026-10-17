import { describe, expect, it } from 'vitest'
import { weekTotals } from '@shared/tracking/plan'
import { dayMinutes, weekMinutes } from '@shared/tracking/totals'
import {
  DEFAULT_PLAN,
  emptyYear,
  WORK_PLAN,
  type Moment,
  type TrackingYear
} from '@shared/tracking/types'
import { addDays } from '@shared/year'
import { periodOfWeek, periodsOf } from './periods'
import { periodFigures, thisPeriod, thisWeek, weekFigures } from './so-far'

const now: Moment = { date: '2026-10-15', time: '10:00' }
// A Work contract whose weeks start on a Friday, with time in two clients.
const contract: TrackingYear = {
  ...emptyYear('2026-09-25', { ...WORK_PLAN, hoursPerWeek: 1350, clients: ['Luminos', 'Impact'] }),
  weeks: 4,
  adjusts: [
    { id: 'a', date: '2026-10-13', label: 'Proposal', minutes: 300, client: 'Luminos' },
    { id: 'b', date: '2026-10-14', label: 'Notes', minutes: 120, client: 'Impact' },
    { id: 'c', date: '2026-10-02', label: 'Earlier', minutes: 60, client: 'Impact' }
  ]
}

describe('what Home and the Hours page both show', () => {
  it('sums the week exactly as the Week card does', () => {
    const week = thisWeek(contract, now)
    const { minutes, aim } = weekFigures(contract, week, now)
    expect(minutes).toBe(weekMinutes(contract, week, now))
    expect(aim).toBe(weekTotals(contract, addDays(week, 6), now).find((w) => w.from === week)?.plan)
  })

  it('finds the invoice period of the week the Hours page opens on, even when weeks do not start on Monday', () => {
    expect(thisWeek(contract, now)).toBe('2026-10-09')
    const period = thisPeriod(contract, now)
    expect(period).toEqual(periodOfWeek(periodsOf(contract, now), '2026-10-09'))
    expect(period && period.from <= now.date && now.date <= period.to).toBe(true)
  })

  it('adds the clients up to the period', () => {
    const period = thisPeriod(contract, now)
    expect(period?.minutes).toBeGreaterThan(0)
    expect(period?.clients.reduce((n, c) => n + c.minutes, 0)).toBe(period?.minutes)
  })
})

describe('periodFigures: the one decision about time so far', () => {
  it('a plan with a whole-week aim is shown by the invoice period: the month, with its clients', () => {
    const f = periodFigures(contract, now)
    const period = thisPeriod(contract, now)
    expect(f.label).toBe('This month')
    expect(f.minutes).toBe(period?.minutes)
    expect(f.aim).toBe(period?.plan)
    expect(f.clients).toEqual(period?.clients)
    expect(f.today).toBe(dayMinutes(contract, now.date, now))
  })

  it('a contract invoiced by week is shown by the week', () => {
    const weekly = { ...contract, invoice: 'week' as const }
    const f = periodFigures(weekly, now)
    expect(f.label).toBe('This week')
    expect(f.minutes).toBe(thisPeriod(weekly, now)?.minutes)
  })

  it('any other plan is shown by the week, with no clients', () => {
    const research: TrackingYear = {
      ...emptyYear('2026-09-14', DEFAULT_PLAN),
      adjusts: [{ id: 'a', date: '2026-10-15', label: 'Reading', minutes: 90 }]
    }
    const week = thisWeek(research, now)
    const f = periodFigures(research, now)
    expect(f.label).toBe('This week')
    expect(f.minutes).toBe(weekMinutes(research, week, now))
    expect(f.minutes).toBe(90)
    expect(f.aim).toBe(weekFigures(research, week, now).aim)
    expect(f.today).toBe(90)
    expect(f.clients).toEqual([])
  })
})
