import { describe, expect, it } from 'vitest'
import { emptyYear } from '@shared/tracking/types'
import { typicalWeek } from './typical'

const START = '2026-09-21' // a Monday

describe('typicalWeek', () => {
  const year = emptyYear(START)
  year.days['2026-09-21'] = { minutes: 480 } // Mon
  year.days['2026-09-28'] = { minutes: 240 } // Mon
  year.days['2026-09-26'] = { minutes: 60 } // Sat
  year.days['2026-10-05'] = { minutes: 9999 } // today: left out
  const now = { date: '2026-10-05', time: '10:00:00' }

  it('averages each weekday over the days before today', () => {
    const week = typicalWeek(year, now)
    expect(week).toHaveLength(7)
    expect(week[0]).toMatchObject({ weekday: 1, days: 2, average: 360 })
    expect(week[5]).toMatchObject({ weekday: 6, days: 2, average: 30 })
    expect(week[1]).toMatchObject({ weekday: 2, days: 2, average: 0 })
  })
  it('leaves out days off', () => {
    const off = { ...year, timeOff: [{ date: '2026-09-28', type: 'leave' as const }] }
    expect(typicalWeek(off, now)[0]).toMatchObject({ days: 1, average: 480 })
  })
  it('has an aim on work days only, and averages of zero before any day has passed', () => {
    const week = typicalWeek(year, { date: START, time: '09:00:00' })
    expect(week.every((d) => d.days === 0 && d.average === 0)).toBe(true)
    expect(week[0].aim).toBe(450)
    expect(week[5].aim).toBeNull()
  })
})
