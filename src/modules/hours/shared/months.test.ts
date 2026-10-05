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

describe('monthsOf for a contract that runs Wednesday to Tuesday', () => {
  const old = { ...emptyYear('2025-10-01', WORK_PLAN), weeks: 26 }
  const months = monthsOf(old)

  it("ends every month on the last day of the week that holds the calendar month's last day", () => {
    expect(months.map((m) => [m.name, m.from, m.to, m.weeks.length])).toEqual([
      ['October', '2025-10-01', '2025-11-04', 5],
      ['November', '2025-11-05', '2025-12-02', 4],
      ['December', '2025-12-03', '2026-01-06', 5],
      ['January', '2026-01-07', '2026-02-03', 4],
      ['February', '2026-02-04', '2026-03-03', 4],
      ['March', '2026-03-04', '2026-03-31', 4]
    ])
  })

  it('has a plan of eight hours a week, so a month is its weeks times eight', () => {
    expect(months.map((m) => m.plan)).toEqual([2400, 1920, 2400, 1920, 1920, 1920])
  })
})

describe('clients in a month', () => {
  const y = {
    ...contract,
    adjusts: [
      { id: 'a', date: '2026-10-02', label: 'x', minutes: 300, client: 'Impact' },
      { id: 'b', date: '2026-10-29', label: 'y', minutes: 60, client: 'Teaching & Learning' },
      { id: 'c', date: '2026-09-30', label: 'z', minutes: 90, client: 'Impact' }
    ]
  }

  it('totals each client over the month, adding up to the month', () => {
    const months = monthsOf(y)
    const oct = months.find((m) => m.name === 'October')!
    expect(oct.clients).toEqual([
      { client: 'Impact', minutes: 300 },
      { client: 'Teaching & Learning', minutes: 60 }
    ])
    for (const m of months) expect(m.clients.reduce((n, c) => n + c.minutes, 0)).toBe(m.minutes)
  })

  it('has none where the plan has no clients', () => {
    const research = { ...y, plan: { ...y.plan, clients: undefined } }
    expect(monthsOf(research).every((m) => m.clients.length === 0)).toBe(true)
  })
})
