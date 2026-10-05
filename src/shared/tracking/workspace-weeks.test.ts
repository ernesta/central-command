import { describe, expect, it } from 'vitest'
import { trackingStarts, weekStartDay } from './workspace-weeks'
import { dailyAim, weekTotals, yearTotals } from './plan'
import { emptyYear, WORK_PLAN } from './types'

describe('workspace weeks', () => {
  it('moves the shared Monday starts to Friday for Work only', () => {
    expect(weekStartDay('work')).toBe(5)
    expect(trackingStarts('work', ['2026-09-21'])).toEqual(['2026-09-25'])
    expect(trackingStarts('research', ['2026-09-21'])).toEqual(['2026-09-21'])
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
})
