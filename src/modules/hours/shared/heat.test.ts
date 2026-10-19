import { describe, expect, it } from 'vitest'
import { emptyYear } from '@shared/tracking/types'
import { heatDays, heatGrid, heatLevel, heatWindow, monthColumns } from './heat'

const START = '2026-09-21'
const NOW = { date: '2026-09-25', time: '12:00:00' }

describe('heatLevel', () => {
  it('is empty with no time, and steps at half and all of the reference', () => {
    expect(heatLevel(0, 450)).toBe(0)
    expect(heatLevel(224, 450)).toBe(1)
    expect(heatLevel(225, 450)).toBe(2)
    expect(heatLevel(449, 450)).toBe(2)
    expect(heatLevel(450, 450)).toBe(3)
    expect(heatLevel(60, 0)).toBe(3)
  })
})

describe('heatDays', () => {
  const year = emptyYear(START)
  year.days['2026-09-22'] = { minutes: 450 }
  year.days['2026-09-26'] = { minutes: 60 } // a Saturday
  year.timeOff = [
    { date: '2026-09-23', type: 'leave' },
    { date: '2026-10-05', type: 'public' }
  ]
  const days = heatDays(year, NOW)

  it('has every day of the year, starting on the start', () => {
    expect(days).toHaveLength(364)
    expect(days[0].date).toBe(START)
    expect(days[363].date).toBe('2027-09-19')
  })
  it('gives each day its level, aim, day off and whether it is still to come', () => {
    const by = (d: string): (typeof days)[number] => days.find((x) => x.date === d)!
    expect(by('2026-09-22')).toMatchObject({ minutes: 450, level: 3, off: null, future: false })
    expect(by('2026-09-22').aim).toBe(450)
    expect(by('2026-09-23')).toMatchObject({ off: 'leave', aim: null, level: 0 })
    expect(by('2026-09-26')).toMatchObject({ aim: null, level: 1 }) // weekend work, against an average day
    expect(by('2026-09-25').future).toBe(false)
    expect(by('2026-09-26').future).toBe(true)
  })
})

describe('monthColumns', () => {
  const cols = monthColumns(emptyYear(START))
  it('labels each month on the first week whose Thursday is in it', () => {
    expect(cols[0]).toEqual({ column: 1, month: 9 })
    expect(cols[1]).toEqual({ column: 6, month: 10 })
  })
  it('leaves out a month too short to hold its name before the next begins', () => {
    // September starts the year with a single week before October; it is not labelled there, but is at the end.
    expect(cols).toHaveLength(12)
    expect(cols[11].month).toBe(8)
    for (let i = 1; i < cols.length; i++)
      expect(cols[i].column - cols[i - 1].column).toBeGreaterThanOrEqual(3)
  })
})

describe('monthColumns in a window', () => {
  const year = emptyYear(START)
  it('counts columns from the window and always labels its first week', () => {
    const cols = monthColumns(year, 20, 12)
    expect(cols[0].column).toBe(0)
    expect(cols.every((c) => c.column < 12)).toBe(true)
    // Week 20 starts on 8 Feb 2027 (Thursday 11 Feb), so February is labelled first.
    expect(cols[0].month).toBe(1)
  })
})

describe('heatWindow', () => {
  it("ends with today's week once there are enough weeks behind it", () => {
    expect(heatWindow(52, 30, 24)).toEqual({ first: 7, count: 24 })
  })
  it('starts at the first week early in the year and fills on into the weeks to come', () => {
    expect(heatWindow(52, 3, 24)).toEqual({ first: 0, count: 24 })
    expect(heatWindow(52, 23, 24)).toEqual({ first: 0, count: 24 })
    expect(heatWindow(52, 24, 24)).toEqual({ first: 1, count: 24 })
  })
  it('never runs past the last week, and treats a day outside the year as its edge', () => {
    expect(heatWindow(52, 51, 24)).toEqual({ first: 28, count: 24 })
    expect(heatWindow(52, 80, 24)).toEqual({ first: 28, count: 24 })
    expect(heatWindow(52, -4, 24)).toEqual({ first: 0, count: 24 })
  })
  it('shows a short year whole, and at least one week when there is no room', () => {
    expect(heatWindow(20, 5, 24)).toEqual({ first: 0, count: 20 })
    expect(heatWindow(52, 10, 0)).toEqual({ first: 10, count: 1 })
  })
})

describe('heatDays with no aim', () => {
  const year = emptyYear(START)
  year.plan.hoursPerWeek = 0
  year.plan.weekAim = true
  year.days['2026-09-22'] = { minutes: 240 }
  year.days['2026-09-23'] = { minutes: 60 }
  year.days['2026-09-24'] = { minutes: 150 }
  const days = heatDays(year, NOW)
  const level = (date: string): number => days.find((d) => d.date === date)!.level

  it('shades each day against the busiest one', () => {
    expect(level('2026-09-22')).toBe(3)
    expect(level('2026-09-24')).toBe(2)
    expect(level('2026-09-23')).toBe(1)
    expect(level('2026-09-25')).toBe(0)
  })
})

describe('heatGrid', () => {
  const friday = emptyYear('2026-09-25') // a Friday, 52 weeks
  const days = heatDays(friday, NOW)

  it('starts its weeks on the day asked for, with empty cells before the first day', () => {
    const grid = heatGrid(friday, days, 1)
    // Friday is the fifth day of a Monday week: four empty cells, then the year.
    expect(grid.slice(0, 4)).toEqual([null, null, null, null])
    expect(grid[4]?.date).toBe('2026-09-25')
    expect(grid[7]?.date).toBe('2026-09-28') // a Monday: row 0 of the second column
  })
  it('is whole weeks, empty after the last day', () => {
    const grid = heatGrid(friday, days, 1)
    expect(grid.length % 7).toBe(0)
    expect(grid.length).toBe(53 * 7)
    expect(grid.at(-1)).toBeNull()
  })
  it('has no empty cells when the year starts on the first day', () => {
    const monday = emptyYear(START)
    const grid = heatGrid(monday, heatDays(monday, NOW), 1)
    expect(grid[0]?.date).toBe(START)
    expect(grid.every((d) => d !== null)).toBe(true)
  })
  it('keeps month labels on the right columns when the grid starts early', () => {
    const lead = 4
    // Column 1 is Mon 28 Sep to Sun 4 Oct, whose Thursday is 1 Oct; September's single column is too short to label.
    expect(monthColumns(friday, 0, 53, lead)[0]).toEqual({ column: 1, month: 9 })
  })
})
