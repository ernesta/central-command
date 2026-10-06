import { describe, expect, it } from 'vitest'
import { contractLabel, contractWeeks } from './workspace-weeks'
import { dailyAim, weekTotals, yearTotals } from './plan'
import { emptyYear, WORK_PLAN } from './types'

describe('contractWeeks', () => {
  it('is whole weeks from a Friday to a Thursday', () => {
    expect(contractWeeks('2026-05-01', '2026-10-29')).toEqual({ ok: true, weeks: 26 })
    expect(contractWeeks('2026-05-01', '2026-05-07')).toEqual({ ok: true, weeks: 1 })
  })
  it('is whole weeks from any weekday: a Wednesday to a Tuesday', () => {
    expect(contractWeeks('2025-10-01', '2026-03-31')).toEqual({ ok: true, weeks: 26 })
  })
  it('refuses an end that is not the day before a week would begin, and a start that is not a date', () => {
    expect(contractWeeks('2026-05-01', '2026-10-31')).toEqual({ ok: false, reason: 'bad-end' })
    expect(contractWeeks('2025-10-01', '2026-04-01')).toEqual({ ok: false, reason: 'bad-end' })
    expect(contractWeeks('2026-05-01', '2026-04-30')).toEqual({ ok: false, reason: 'bad-end' })
    expect(contractWeeks('2026-02-30', '2026-10-29')).toEqual({ ok: false, reason: 'bad-start' })
    expect(contractWeeks('', '2026-10-29')).toEqual({ ok: false, reason: 'bad-start' })
  })
})

describe('a week aimed at as a whole', () => {
  const year = {
    ...emptyYear('2026-09-25', WORK_PLAN),
    adjusts: [{ id: 'a', date: '2026-09-27', label: 'x', minutes: 120 }]
  }

  it('has no daily aim', () => {
    expect(dailyAim(year, '2026-09-26')).toBeNull()
  })

  it('is 8:00 behind on the first day of the week and counts a burst against it', () => {
    expect(yearTotals(emptyYear('2026-09-25', WORK_PLAN), '2026-09-25').balance).toBe(-480)
    expect(yearTotals(year, '2026-09-25').balance).toBe(-480)
    expect(yearTotals(year, '2026-09-27').balance).toBe(120 - 480)
    expect(yearTotals(year, '2026-10-01').balance).toBe(120 - 480)
  })

  it('adds the next week from its own first day (a Friday)', () => {
    expect(yearTotals(year, '2026-10-02').balance).toBe(120 - 960)
    const weeks = weekTotals(year, '2026-10-02')
    expect(weeks[0]).toMatchObject({ from: '2026-09-25', to: '2026-10-01', plan: 480 })
    expect(weeks[1]).toMatchObject({ from: '2026-10-02', plan: 480 })
    expect(weeks[2].plan).toBe(0)
  })

  it("stops at the contract's last week", () => {
    const contract = { ...emptyYear('2026-05-01', WORK_PLAN), weeks: 26 }
    expect(weekTotals(contract, '2026-12-01')).toHaveLength(26)
    expect(yearTotals(contract, '2026-12-01').balance).toBe(-26 * 480)
  })
})

describe('contractLabel', () => {
  it('names a contract by its name and dates, or by the dates alone', () => {
    expect(contractLabel('2026-05-01', 26, 'Luminos')).toBe('Luminos · May 1, 2026 – Oct 29, 2026')
    expect(contractLabel('2026-05-01', 26)).toBe('May 1, 2026 – Oct 29, 2026')
    expect(contractLabel('2026-05-01', undefined, 'Luminos')).toBe('Luminos · May 1, 2026')
  })
})
