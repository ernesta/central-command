import { describe, expect, it } from 'vitest'
import { emptyYear } from '@shared/tracking/types'
import { heatDays, heatLevel, monthColumns } from './heat'

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
