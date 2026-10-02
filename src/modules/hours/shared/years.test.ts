import { describe, expect, it } from 'vitest'
import { emptyYear } from '@shared/tracking/types'
import { yearRows } from './years'

describe('yearRows', () => {
  const older = emptyYear('2025-09-22')
  older.days['2025-09-22'] = { minutes: 450 }
  older.timeOff = [{ date: '2025-12-24', type: 'university' }]
  const newer = emptyYear('2026-09-21')
  newer.days['2026-09-21'] = { minutes: 300 }
  const now = { date: '2026-09-23', time: '10:00:00' }

  it('lists the newest year first, with its dates', () => {
    const rows = yearRows([older, newer], now)
    expect(rows.map((r) => r.start)).toEqual(['2026-09-21', '2025-09-22'])
    expect(rows[1].end).toBe('2026-09-20')
  })
  it('gives each year its hours, plan, balance and days off taken', () => {
    const [current, past] = yearRows([older, newer], now)
    expect(current).toMatchObject({ minutes: 300, plan: 1350, balance: -1050, daysOff: 0 })
    // A finished year is counted in full: 51 weeks of the plan cannot be less than a week's.
    expect(past.minutes).toBe(450)
    expect(past.plan).toBeGreaterThan(current.plan)
    expect(past.daysOff).toBe(1)
  })
})
