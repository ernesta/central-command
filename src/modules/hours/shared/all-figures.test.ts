import { describe, expect, it } from 'vitest'
import { emptyYear, WORK_PLAN, type Moment, type TrackingYear } from '@shared/tracking/types'
import { allFigures, mergeClients } from './all-figures'

const now: Moment = { date: '2026-11-03', time: '12:00' }
const contract = (
  start: string,
  end: string,
  name: string,
  clients: string[],
  adjusts: TrackingYear['adjusts']
): TrackingYear => ({
  ...emptyYear(start, { ...WORK_PLAN, clients }),
  name,
  weeks: 40,
  end,
  adjusts
})
const luminos = contract(
  '2026-10-30',
  '2026-11-26',
  'Luminos',
  ['Impact', 'Teaching'],
  [
    { id: 'a', date: '2026-11-03', label: 'x', minutes: 120, client: 'Impact' },
    { id: 'b', date: '2026-11-02', label: 'y', minutes: 60, client: 'Teaching' }
  ]
)
const holloway0 = contract(
  '2026-09-28',
  '2027-03-28',
  'Royal Holloway',
  ['Royal Holloway'],
  [
    { id: 'c', date: '2026-11-03', label: 'z', minutes: 30, client: 'Royal Holloway' },
    { id: 'd', date: '2026-10-05', label: 'old', minutes: 600, client: 'Royal Holloway' }
  ]
)

const holloway: TrackingYear = { ...holloway0, invoice: 'week' }

describe('allFigures', () => {
  it('sums today and the week over every contract, per client', () => {
    const f = allFigures([luminos, holloway], now)
    expect(f.today).toBe(150)
    expect(f.todayClients).toEqual([
      { client: 'Impact', minutes: 120 },
      { client: 'Royal Holloway', minutes: 30 }
    ])
    expect(f.week.minutes).toBe(210)
    expect(f.contracts.map((c) => [c.name, c.label])).toEqual([
      ['Luminos', 'This month'],
      ['Royal Holloway', 'This week']
    ])
  })
  it('does not depend on the order, or on which contract a page would show', () => {
    expect(allFigures([holloway, luminos], now).today).toBe(150)
  })
  it('a contract with no client worked today is still listed', () => {
    const f = allFigures([luminos, { ...holloway, adjusts: [] }], now)
    expect(f.contracts).toHaveLength(2)
    expect(f.contracts[1].minutes).toBe(0)
  })
  it('no contract holds today: nothing', () => {
    const f = allFigures([luminos], { date: '2026-12-15', time: '10:00' })
    expect(f).toEqual({
      today: 0,
      todayClients: [],
      week: { minutes: 0, clients: [] },
      contracts: []
    })
  })
})

describe('mergeClients', () => {
  it('adds the same client once and drops empty ones', () => {
    expect(
      mergeClients([
        { clients: [{ client: 'A', minutes: 30 }] },
        {
          clients: [
            { client: 'A', minutes: 15 },
            { client: 'B', minutes: 0 }
          ]
        }
      ])
    ).toEqual([{ client: 'A', minutes: 45 }])
  })
})
