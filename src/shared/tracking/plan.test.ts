import { describe, expect, it } from 'vitest'
import { dailyAim, plannedDays, weekPlan, weekTotals, yearTotals } from './plan'
import { formatHours, formatSignedHours } from './format'
import { addDays, weeksOf } from '../year'
import { year } from './test-utils'
import type { TimeOffEntry, TrackingYear } from './types'

const W1 = '2026-09-21'

function withOff(...dates: string[]): TimeOffEntry[] {
  return dates.map((date) => ({ date, type: 'university' as const }))
}

describe('planned days and the aim', () => {
  it('is Monday to Friday for Research, less days off, and ignores a weekend date', () => {
    expect(plannedDays(year(), W1)).toBe(5)
    expect(plannedDays(year({ timeOff: withOff('2026-09-24') }), W1)).toBe(4)
    expect(plannedDays(year({ timeOff: withOff('2026-09-26', '2026-09-27') }), W1)).toBe(5)
    expect(
      plannedDays(
        year({
          timeOff: withOff('2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25')
        }),
        W1
      )
    ).toBe(0)
  })
  it('prefers the days typed in the old sheet for a week', () => {
    expect(plannedDays(year({ weekDays: { [W1]: 3 } }), W1)).toBe(3)
    expect(plannedDays(year({ weekDays: { [W1]: 0 } }), W1)).toBe(0)
  })
  it('aims at the week over the days worked on a planned day only', () => {
    const y = year({ timeOff: withOff('2026-09-24') })
    expect(dailyAim(y, '2026-09-21')).toBe(450)
    expect(dailyAim(y, '2026-09-24')).toBeNull()
    expect(dailyAim(y, '2026-09-26')).toBeNull()
    expect(dailyAim(y, '2020-01-01')).toBeNull()
  })
  it('fits a weekly total over chosen days (8 hours a week on two days)', () => {
    const y = year({ plan: { hoursPerWeek: 480, workDays: [2, 4], allowanceDays: 0 } })
    expect(dailyAim(y, '2026-09-22')).toBe(240)
    expect(dailyAim(y, '2026-09-21')).toBeNull()
    expect(plannedDays(y, W1)).toBe(2)
    expect(weekPlan(y, W1)).toBe(480)
    expect(weekPlan(year({ ...y, timeOff: withOff('2026-09-22') }), W1)).toBe(240)
  })
  it('has no plan without work days', () => {
    const y = year({ plan: { hoursPerWeek: 480, workDays: [], allowanceDays: 0 } })
    expect(weekPlan(y, W1)).toBe(0)
    expect(dailyAim(y, W1)).toBeNull()
    expect(yearTotals(y, '2026-10-01').averageWeek).toBeNull()
  })
  it('takes a day’s share off the week', () => {
    expect(weekPlan(year(), W1)).toBe(2250)
    expect(weekPlan(year({ timeOff: withOff('2026-09-24') }), W1)).toBe(1800)
  })
})

describe('the balance counts the plan up to and including today', () => {
  const y: TrackingYear = year({
    days: {
      '2026-09-21': { minutes: 450 },
      '2026-09-22': { minutes: 450 },
      '2026-09-23': { minutes: 180 }
    }
  })
  it('does not punish a week still in progress', () => {
    const t = yearTotals(y, '2026-09-23')
    expect(t.minutes).toBe(1080)
    expect(t.plannedDays).toBe(3)
    expect(t.plan).toBe(1350)
    expect(t.balance).toBe(-270)
    expect(t.averageWeek).toBeCloseTo((1080 / 3) * 5)
  })
  it('counts today in full and not tomorrow', () => {
    expect(yearTotals(y, '2026-09-22').plan).toBe(900)
    expect(yearTotals(y, '2026-09-24').plan).toBe(1800)
  })
  it('counts a day off today or earlier out of the plan so far, and a weekend not at all', () => {
    const off = year({ ...y, timeOff: withOff('2026-09-22') })
    expect(yearTotals(off, '2026-09-23').plan).toBe(900)
    expect(yearTotals(y, '2026-09-27').plan).toBe(2250)
  })
  it('has no plan before the year, and the whole year’s plan is separate', () => {
    expect(yearTotals(y, '2026-09-20').plan).toBe(0)
    expect(yearTotals(y, '2026-09-23').wholePlan).toBe(52 * 2250 - 40 * 450)
    expect(yearTotals(year({ timeOff: withOff('2026-12-24') }), '2026-09-23').wholePlan).toBe(
      52 * 2250 - 40 * 450
    )
  })
  it('includes the running task’s provisional time when asked', () => {
    const running = year({
      sessions: [{ id: 'r', date: '2026-09-21', start: '09:00:00', end: null, label: 'A' }]
    })
    expect(yearTotals(running, '2026-09-21').minutes).toBe(0)
    expect(
      yearTotals(running, '2026-09-21', { date: '2026-09-21', time: '10:00:00' }).minutes
    ).toBe(60)
  })
})

describe('the real 2025–26 numbers', () => {
  // The sheet's daily rows: 220 planned days (44 five-day weeks), 1,523:30 in quarter hours.
  const start = '2025-09-22'
  const days: TrackingYear['days'] = {}
  const weekDays: TrackingYear['weekDays'] = {}
  let n = 0
  weeksOf(start).forEach((w, i) => {
    weekDays[w.from] = i < 44 ? 5 : 0
    if (i >= 44) return
    for (let d = 0; d < 5; d++) days[addDays(w.from, d)] = { minutes: (n++ < 154 ? 28 : 27) * 15 }
  })
  const y = year({
    start,
    days,
    weekDays,
    plan: { hoursPerWeek: 2250, workDays: [1, 2, 3, 4, 5], allowanceDays: 0 }
  })

  it('gives 1,523:30 over 220 planned days, balance −126:30 and an average week of 34:38', () => {
    const t = yearTotals(y, '2026-09-20')
    expect(formatHours(t.minutes)).toBe('1,523:30')
    expect(t.plannedDays).toBe(220)
    expect(formatSignedHours(t.balance)).toBe('−126:30')
    expect(formatHours(t.averageWeek!)).toBe('34:38')
  })
  it('is not the sheet’s own −122:30: its weekly column counted 4 hours twice', () => {
    // The sheet's total was 1,527:30, so its balance was 4 h better than the days say.
    const sheet = 1527.5 * 60 - 220 * 450
    expect(formatSignedHours(sheet)).toBe('−122:30')
    expect(yearTotals(y, '2026-09-20').balance - sheet).toBe(-4 * 60)
  })
  it('has a week table whose running balance ends at the year’s balance', () => {
    const weeks = weekTotals(y, '2026-09-20')
    expect(weeks).toHaveLength(52)
    expect(weeks[51].yearBalance).toBe(yearTotals(y, '2026-09-20').balance)
    expect(weeks.reduce((s, w) => s + w.minutes, 0)).toBe(91410)
    expect(weeks[0]).toMatchObject({ number: 1, plannedDays: 5, plan: 2250, inProgress: false })
  })
  it('marks only the week still to finish as in progress', () => {
    const weeks = weekTotals(y, '2026-01-14')
    expect(weeks.filter((w) => w.inProgress).length).toBe(
      weeks.filter((w) => w.to > '2026-01-14').length
    )
    expect(weeks.find((w) => w.from <= '2026-01-14' && w.to >= '2026-01-14')!.inProgress).toBe(true)
  })
})

describe('allowance days not listed as days off', () => {
  const start = '2026-09-21'
  const lastDay = addDays(start, 52 * 7 - 1)
  const listed = (n: number): TimeOffEntry[] =>
    withOff(...Array.from({ length: n }, (_, i) => addDays(start, 7 * i + 3)))

  it('come off the plan on the last day, not before, and not out of any week’s own plan', () => {
    const y = year({ timeOff: listed(39) })
    const before = yearTotals(y, addDays(lastDay, -1))
    const after = yearTotals(y, lastDay)
    expect(after.plan - before.plan).toBe(-450)
    expect(weekPlan(y, addDays(start, 51 * 7))).toBe(2250)
  })
  it('credit a day never taken on top of the hours worked', () => {
    const taken40 = yearTotals(year({ timeOff: listed(40) }), lastDay)
    const taken39 = yearTotals(year({ timeOff: listed(39) }), lastDay)
    // Taking the 40th day removes its plan from its own week; not taking it removes the same at the year's end.
    expect(taken40.plan).toBe(taken39.plan)
  })
  it('make the whole year’s plan the weekdays less the allowance, whatever is listed', () => {
    for (const n of [0, 14, 39, 40])
      expect(yearTotals(year({ timeOff: listed(n) }), start).wholePlan).toBe((260 - 40) * 450)
  })
  it('add nothing when more is listed than the allowance', () => {
    const y = year({ timeOff: listed(41) })
    expect(yearTotals(y, lastDay).plan).toBe(yearTotals(y, addDays(lastDay, -1)).plan)
  })
  it('end the running balance with the credit once, in the last week only', () => {
    const y = year({ timeOff: listed(39) })
    const weeks = weekTotals(y, lastDay)
    expect(weeks[51].yearBalance).toBe(yearTotals(y, lastDay).balance)
    expect(weeks[51].yearBalance - weeks[50].yearBalance).toBe(weeks[51].balance + 450)
    expect(weekTotals(y, addDays(lastDay, -1))[51].yearBalance).toBe(
      yearTotals(y, addDays(lastDay, -1)).balance
    )
  })
})
