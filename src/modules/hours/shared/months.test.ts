import { describe, expect, it } from 'vitest'
import { emptyYear, WORK_PLAN } from '@shared/tracking/types'
import { monthOfWeek, monthsOf } from './months'

const contract = {
  ...emptyYear('2026-05-01', WORK_PLAN),
  weeks: 26,
  adjusts: [
    { id: 'a', date: '2026-10-02', label: 'x', minutes: 300 },
    { id: 'b', date: '2026-10-29', label: 'y', minutes: 60 },
    { id: 'c', date: '2026-09-30', label: 'z', minutes: 90 }
  ]
}

describe('monthsOf', () => {
  const months = monthsOf(contract)

  it('cuts a contract into months of whole weeks, each starting the day after the last ended', () => {
    expect(months.map((m) => m.name)).toEqual([
      'May',
      'June',
      'July',
      'August',
      'September',
      'October'
    ])
    for (let i = 1; i < months.length; i++) {
      const [y, m, d] = months[i - 1].to.split('-').map(Number)
      const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
      expect(months[i].from).toBe(next)
    }
    expect(months.reduce((n, m) => n + m.weeks.length, 0)).toBe(26)
  })

  it('ends a month on the Thursday on or after the last day of the calendar month', () => {
    // 30 Sep 2026 is a Wednesday; 31 Oct is a Saturday.
    const sep = months.find((m) => m.name === 'September')!
    expect(sep.to).toBe('2026-10-01')
    expect(months[0]).toMatchObject({ name: 'May', from: '2026-05-01', to: '2026-06-04' })
  })

  it('ends the contract with October, four weeks long (Oct 2 to 29)', () => {
    const oct = months[months.length - 1]
    expect(oct).toMatchObject({ from: '2026-10-02', to: '2026-10-29' })
    expect(oct.weeks).toHaveLength(4)
    expect(oct.plan).toBe(4 * 480)
  })

  it('adds up the hours and the plan of its weeks', () => {
    const oct = months[months.length - 1]
    expect(oct.minutes).toBe(360)
    expect(oct.weeks[0].minutes).toBe(300)
    expect(oct.weeks[3].minutes).toBe(60)
    expect(months.find((m) => m.name === 'September')!.minutes).toBe(90)
  })

  it('finds the month of a week', () => {
    expect(monthOfWeek(months, '2026-10-16')?.name).toBe('October')
    expect(monthOfWeek(months, '2026-10-17')).toBeNull()
  })
})
