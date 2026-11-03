import { describe, expect, it } from 'vitest'
import {
  allDay,
  allWeek,
  ALL_CONTRACTS,
  resolveAllWeek,
  scopeYears,
  validScope,
  weekBounds,
  workWeekStart
} from './scope'
import { emptyYear, WORK_PLAN, type Moment, type TrackingYear } from './types'
import { weekdayOf } from '../year'
import { withDerived } from './derived'

const now: Moment = { date: '2026-11-03', time: '12:00' }

const contract = (
  start: string,
  end: string,
  name: string,
  clients: string[],
  adjusts: TrackingYear['adjusts'] = []
): TrackingYear => ({
  ...emptyYear(start, { ...WORK_PLAN, clients }),
  name,
  weeks: Math.ceil((Date.parse(end) - Date.parse(start)) / 86400000 / 7 + 1 / 7),
  end,
  adjusts
})
const entry = (
  id: string,
  date: string,
  minutes: number,
  client: string
): TrackingYear['adjusts'][number] => ({ id, date, label: id, minutes, client })

// Luminos ends 29 Nov; Royal Holloway overlaps it (from 28 Sep to 28 Mar).
const luminos = contract(
  '2026-10-30',
  '2026-11-26',
  'Luminos',
  ['Impact', 'Teaching'],
  [
    entry('a', '2026-11-03', 120, 'Impact'),
    entry('b', '2026-11-03', 60, 'Teaching'),
    entry('c', '2026-11-27', 600, 'Impact') // after the contract's end: counts nowhere
  ]
)
const holloway = contract(
  '2026-09-28',
  '2027-03-28',
  'Royal Holloway',
  ['Royal Holloway'],
  [entry('d', '2026-11-04', 90, 'Royal Holloway')]
)
const ended = contract(
  '2026-05-01',
  '2026-10-29',
  'Luminos',
  ['Impact'],
  [entry('e', '2026-10-10', 480, 'Impact')]
)
const all = [luminos, holloway, ended]

describe('scopeYears', () => {
  it('under All, every contract that holds the date', () => {
    expect(scopeYears(all, ALL_CONTRACTS, '2026-11-03').map((y) => y.start)).toEqual([
      '2026-10-30',
      '2026-09-28'
    ])
  })
  it('none holding the date: none', () => {
    expect(scopeYears(all, ALL_CONTRACTS, '2026-04-01')).toEqual([])
    expect(scopeYears(all, ALL_CONTRACTS, '2026-11-28').map((y) => y.start)).toEqual(['2026-09-28'])
  })
  it('one contract: that one only, and only on a day it holds', () => {
    expect(scopeYears(all, '2026-09-28', '2026-11-03').map((y) => y.start)).toEqual(['2026-09-28'])
    expect(scopeYears(all, '2026-10-30', '2026-11-28')).toEqual([])
    expect(scopeYears(all, '2000-01-01', '2026-11-03')).toEqual([])
  })
})

describe('validScope', () => {
  const starts = all.map((y) => y.start)
  it('keeps All and a contract that exists, drops the rest', () => {
    expect(validScope('all', starts)).toBe('all')
    expect(validScope('2026-09-28', starts)).toBe('2026-09-28')
    expect(validScope('2020-01-01', starts)).toBeNull()
    expect(validScope(undefined, starts)).toBeNull()
    expect(validScope(7, starts)).toBeNull()
  })
})

describe('allDay', () => {
  it('sums every contract that holds the day, per contract and client', () => {
    const day = allDay(all, '2026-11-03', now)
    expect(day.minutes).toBe(180)
    expect(day.contracts.map((c) => [c.name, c.minutes])).toEqual([
      ['Luminos', 180],
      ['Royal Holloway', 0]
    ])
    expect(day.contracts[0].clients).toEqual([
      { client: 'Impact', minutes: 120 },
      { client: 'Teaching', minutes: 60 }
    ])
  })
  it('a day worked on the contract that is not the shown one is counted (the bug that started this)', () => {
    // Royal Holloway is the contract the page used to show; the day was worked for Luminos.
    const day = allDay([holloway, luminos], '2026-11-03', now)
    expect(day.minutes).toBe(180)
    expect(allDay([holloway], '2026-11-03', now).minutes).toBe(0)
  })
  it('two overlapping contracts both worked: both counted, none twice', () => {
    const both = contract(
      '2026-09-28',
      '2027-03-28',
      'Royal Holloway',
      ['Royal Holloway'],
      [entry('x', '2026-11-03', 45, 'Royal Holloway')]
    )
    const day = allDay([luminos, both], '2026-11-03', now)
    expect(day.minutes).toBe(225)
    expect(day.contracts.flatMap((c) => c.clients).length).toBe(3)
  })
  it('no contract holds the day: nothing', () => {
    const day = allDay(all, '2026-04-01', now)
    expect(day).toEqual({ date: '2026-04-01', minutes: 0, contracts: [] })
  })
  it('counts the hours a note derives, in the contract whose client it is', () => {
    const shown = [luminos, holloway].map((y) =>
      withDerived(y, [
        {
          id: 'm',
          date: '2026-11-03',
          start: '10:00',
          end: '11:00',
          task: 'cc://task/1',
          label: 'Call',
          client: 'Royal Holloway'
        }
      ])
    )
    const day = allDay(shown, '2026-11-03', now)
    expect(day.minutes).toBe(180 + 60)
    expect(day.contracts.find((c) => c.name === 'Royal Holloway')?.minutes).toBe(60)
  })
  it('a day after a contract ends is not its', () => {
    expect(allDay([luminos], '2026-11-27', now)).toEqual({
      date: '2026-11-27',
      minutes: 0,
      contracts: []
    })
  })
})

describe('Work week', () => {
  it('begins on a Friday', () => {
    expect(workWeekStart('2026-11-03')).toBe('2026-10-30')
    expect(workWeekStart('2026-10-30')).toBe('2026-10-30')
    expect(workWeekStart('2026-11-05')).toBe('2026-10-30')
    expect(workWeekStart('2026-11-06')).toBe('2026-11-06')
    expect(weekdayOf(workWeekStart('2027-01-01'))).toBe(5)
  })
})

describe('allWeek', () => {
  it('adds the days of every contract in the week, each day inside the contract that holds it', () => {
    const week = allWeek(all, '2026-10-30', now)
    expect(week.to).toBe('2026-11-05')
    expect(week.minutes).toBe(120 + 60 + 90)
    expect(week.days.map((d) => d.minutes)).toEqual([0, 0, 0, 0, 180, 90, 0])
    expect(week.contracts.map((c) => [c.name, c.minutes])).toEqual([
      ['Luminos', 180],
      ['Royal Holloway', 90]
    ])
  })
  it('does not count time after a contract ended, even inside the week', () => {
    // Luminos ends 26 Nov; the 27th has 10:00 typed that no contract owns.
    const week = allWeek([luminos], '2026-11-24', now)
    expect(week.contracts.map((c) => c.name)).toEqual(['Luminos'])
    expect(week.minutes).toBe(0)
  })
  it('leaves out a contract with no day in the week', () => {
    expect(allWeek(all, '2026-10-30', now).contracts.some((c) => c.year === '2026-05-01')).toBe(
      false
    )
  })
  it('a week with no contract: zero, nothing listed', () => {
    const week = allWeek(all, '2026-04-03', now)
    expect(week.minutes).toBe(0)
    expect(week.contracts).toEqual([])
  })
})

describe('week bounds', () => {
  it('from the Friday week of the earliest start to that of the latest end', () => {
    expect(weekBounds(all)).toEqual({ first: '2026-05-01', last: '2027-03-26' })
    expect(weekBounds([])).toBeNull()
  })
  it('opens on this week, or the nearest bound, and honours a valid asked week', () => {
    expect(resolveAllWeek(null, all, '2026-11-03')).toBe('2026-10-30')
    expect(resolveAllWeek('2026-10-23', all, '2026-11-03')).toBe('2026-10-23')
    expect(resolveAllWeek('2026-10-24', all, '2026-11-03')).toBe('2026-10-30')
    expect(resolveAllWeek(null, all, '2030-01-01')).toBe('2027-03-26')
    expect(resolveAllWeek(null, all, '2020-01-01')).toBe('2026-05-01')
    expect(resolveAllWeek(null, [], '2026-11-03')).toBe('2026-10-30')
  })
})
