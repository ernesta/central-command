import { describe, expect, it } from 'vitest'
import {
  contractEnd,
  contractLabel,
  contractWeeks,
  dayAfterContract,
  inContract
} from './workspace-weeks'
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
  it('takes any end on or after the start; the weeks are the report grid, rounded up', () => {
    expect(contractWeeks('2026-05-01', '2026-05-01')).toEqual({ ok: true, weeks: 1 })
    expect(contractWeeks('2026-05-01', '2026-05-10')).toEqual({ ok: true, weeks: 2 })
    expect(contractWeeks('2026-05-01', '2026-10-31')).toEqual({ ok: true, weeks: 27 })
    expect(contractWeeks('2025-10-01', '2026-04-01')).toEqual({ ok: true, weeks: 27 })
  })
  it('stops at 156 report weeks', () => {
    // 156 weeks from 2026-05-01 is 1092 days: the last day is 2029-04-26.
    expect(contractWeeks('2026-05-01', '2029-04-26')).toEqual({ ok: true, weeks: 156 })
    expect(contractWeeks('2026-05-01', '2029-04-27')).toEqual({ ok: false, reason: 'bad-end' })
  })
  it('refuses an end before the start, and a start that is not a date', () => {
    expect(contractWeeks('2026-05-01', '2026-04-30')).toEqual({ ok: false, reason: 'bad-end' })
    expect(contractWeeks('2026-02-30', '2026-10-29')).toEqual({ ok: false, reason: 'bad-start' })
    expect(contractWeeks('', '2026-10-29')).toEqual({ ok: false, reason: 'bad-start' })
  })
})

describe('contractEnd and inContract', () => {
  const old = { ...emptyYear('2026-05-01', WORK_PLAN), weeks: 26 }
  const ten = { ...emptyYear('2026-10-30', WORK_PLAN), weeks: 2, end: '2026-11-08' }

  it('reads an old file (no end) as the last day of its last report week', () => {
    expect(contractEnd(old)).toBe('2026-10-29')
    expect(inContract('2026-10-29', old)).toBe(true)
    expect(inContract('2026-10-30', old)).toBe(false)
    expect(inContract('2026-04-30', old)).toBe(false)
  })

  it('stops at the real end: a day after it in the last report week is in no contract', () => {
    expect(contractEnd(ten)).toBe('2026-11-08')
    expect(inContract('2026-10-30', ten)).toBe(true)
    expect(inContract('2026-11-08', ten)).toBe(true)
    expect(inContract('2026-11-09', ten)).toBe(false)
    expect(inContract('2026-11-12', ten)).toBe(false)
  })

  it('a research year (52 weeks, no end) is unchanged', () => {
    const year = emptyYear('2026-09-21')
    expect(contractEnd(year)).toBe('2027-09-19')
    expect(inContract('2027-09-19', year)).toBe(true)
    expect(inContract('2027-09-20', year)).toBe(false)
  })

  it('names the day after a contract by its real end', () => {
    expect(dayAfterContract(old)).toBe('2026-10-30')
    expect(dayAfterContract(ten)).toBe('2026-11-09')
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
    expect(contractLabel('2026-10-30', 2, 'Short', '2026-11-08')).toBe(
      'Short · Oct 30, 2026 – Nov 8, 2026'
    )
  })
})
