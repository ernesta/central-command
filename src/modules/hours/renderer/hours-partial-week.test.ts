// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { emptyYear, WORK_PLAN, type TrackingYear } from '@shared/tracking/types'
import { weekTotals, yearTotals } from '@shared/tracking/plan'
import { weeklyMinutes } from '@shared/tracking/totals'
import { heatDays, heatGrid } from '../shared/heat'
import { typicalWeek } from '../shared/typical'
import { periodsOf } from '../shared/periods'
import { WeekCard } from './WeekCard'
import { mount, unmount } from './hours-ui-test-utils'

// A 10-day contract: Fri 30 Oct to Sun 8 Nov 2026. Two report weeks; the second (Fri 6 Nov to Thu 12 Nov) has three days.
const ten: TrackingYear = {
  ...emptyYear('2026-10-30', { ...WORK_PLAN, clients: ['Impact'] }),
  weeks: 2,
  end: '2026-11-08',
  invoice: 'week',
  sessions: [
    {
      id: 's1',
      date: '2026-11-07',
      start: '09:00:00',
      end: '12:00:00',
      minutes: 180,
      label: 'Reading',
      client: 'Impact'
    }
  ]
}
const NOW = { date: '2026-11-07', time: '13:00:00' }

beforeEach(() => {
  ;(window as unknown as { api: unknown }).api = { tracking: {} }
})
afterEach(unmount)

describe('a contract that ends inside its last report week', () => {
  it('stops the last week at the real end, and does not prorate its aim', () => {
    const weeks = weeklyMinutes(ten, NOW)
    expect(weeks.map((w) => [w.from, w.to])).toEqual([
      ['2026-10-30', '2026-11-05'],
      ['2026-11-06', '2026-11-08']
    ])
    expect(weekTotals(ten, '2026-11-20', NOW).map((w) => w.plan)).toEqual([480, 480])
    expect(yearTotals(ten, '2026-11-20', NOW).wholePlan).toBe(960)
  })

  it('the heat map and typical week hold only the real days', () => {
    const days = heatDays(ten, NOW)
    expect(days).toHaveLength(10)
    expect(days[9].date).toBe('2026-11-08')
    // The grid pads the last week with empty cells, as it always has.
    expect(heatGrid(ten, days, 1).length % 7).toBe(0)
    const counted = typicalWeek({ ...ten, sessions: [] }, { date: '2026-11-20', time: '10:00:00' })
    expect(counted.reduce((n, d) => n + d.days, 0)).toBe(10)
  })

  it('the invoice period of the last week ends on the real end', () => {
    expect(periodsOf(ten, NOW).map((p) => p.to)).toEqual(['2026-11-05', '2026-11-08'])
  })
})

describe('WeekCard on the partial last week', () => {
  const show = (data = ten): HTMLElement =>
    mount(
      createElement(WeekCard, {
        workspace: 'work',
        data,
        week: '2026-11-06',
        onWeekChange: vi.fn(),
        now: NOW
      })
    )

  it('labels the week to the real end, gives the average per day it has, and has no next week', () => {
    const host = show()
    const text = host.querySelector('section')?.textContent ?? ''
    expect(text).toMatch(/^Week 2 · Nov 6 – Nov 8/)
    expect(text).toMatch(/3 days · 1:00 a day/)
    expect(
      (host.querySelector('button[aria-label="Next week"]') as HTMLButtonElement).disabled
    ).toBe(true)
  })

  it('marks the days after the end as outside: not openable, no hours', () => {
    const host = show()
    const rows = [...host.querySelectorAll('tbody tr')]
    expect(rows).toHaveLength(7)
    expect(rows.map((r) => r.getAttribute('data-outside'))).toEqual([
      null,
      null,
      null,
      'true',
      'true',
      'true',
      'true'
    ])
    for (const row of rows.slice(3)) {
      expect(row.querySelector('button')).toBeNull()
      expect(row.textContent).toContain('—')
    }
    expect(rows[1].querySelector('button')).not.toBeNull()
  })

  it('shows a full week as before: no per-day line', () => {
    const host = mount(
      createElement(WeekCard, {
        workspace: 'work',
        data: ten,
        week: '2026-10-30',
        onWeekChange: vi.fn(),
        now: NOW
      })
    )
    expect(host.querySelector('section')?.textContent).not.toMatch(/a day/)
  })
})
