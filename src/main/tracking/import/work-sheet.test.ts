import { describe, expect, it } from 'vitest'
import { parseWorkSheet } from './work-sheet'
import { serial } from './hours-test-utils'

const HEAD = ['Date', 'Hours', 'Accounted', 'Client', 'Team', 'Activity']
const row = (
  date: string,
  hours: string,
  accounted = 'Yes',
  team = 'Impact',
  activity = 'Audit',
  extra: string[] = []
): string[] => [serial(date), hours, accounted, 'Luminos', team, activity, ...extra]

describe('parseWorkSheet', () => {
  it('reads a row as a date, minutes, accounted, team and a trimmed activity', () => {
    const s = parseWorkSheet([
      HEAD,
      row('2026-03-02', '1.25', 'No', 'Teaching', '  Audit  of   data ')
    ])
    expect(s.problems).toEqual([])
    expect(s.rows).toEqual([
      {
        row: 2,
        date: '2026-03-02',
        hours: 1.25,
        minutes: 75,
        accounted: false,
        team: 'Teaching',
        activity: 'Audit of data'
      }
    ])
  })

  it('reads a whole number of hours and keeps a typo as typed (the plan corrects it)', () => {
    const s = parseWorkSheet([HEAD, row('2025-11-17', '1'), row('2026-10-05', '2.15')])
    expect(s.rows.map((r) => r.minutes)).toEqual([60, 129])
  })

  it('skips blank rows and the week panel, and lists scratch text beside a data row', () => {
    const panel = ['', '', '', '', '', '', '', 'Today (from)', '(to)']
    const s = parseWorkSheet([
      HEAD,
      panel,
      row('2025-10-19', '2', 'Yes', 'Impact', 'Audit', [
        '',
        '1215.0',
        '13.0',
        '',
        'dev meeting prep'
      ])
    ])
    expect(s.problems).toEqual([])
    expect(s.rows).toHaveLength(1)
    expect(s.scratch).toEqual([{ row: 3, text: '1215.0 | 13.0 | dev meeting prep' }])
  })

  it('refuses a row that does not fit instead of skipping it', () => {
    const bad = [
      ['not a date', '1', 'Yes', 'Luminos', 'Impact', 'A'],
      [serial('2026-01-01'), 'abc', 'Yes', 'Luminos', 'Impact', 'A'],
      [serial('2026-01-01'), '0', 'Yes', 'Luminos', 'Impact', 'A'],
      [serial('2026-01-01'), '1', 'Maybe', 'Luminos', 'Impact', 'A'],
      [serial('2026-01-01'), '1', 'Yes', 'Other', 'Impact', 'A'],
      [serial('2026-01-01'), '1', 'Yes', 'Luminos', 'Ops', 'A'],
      [serial('2026-01-01'), '1', 'Yes', 'Luminos', 'Impact', '']
    ]
    const s = parseWorkSheet([HEAD, ...bad])
    expect(s.rows).toEqual([])
    expect(s.problems.filter((p) => p.startsWith('Row '))).toHaveLength(7)
    expect(s.problems.join('\n')).toMatch(/Row 2: the date/)
    expect(s.problems.join('\n')).toMatch(/Row 8: the activity is empty/)
  })

  it('refuses another sheet', () => {
    const s = parseWorkSheet([['Week', 'Hours'], row('2026-01-01', '1')])
    expect(s.rows).toEqual([])
    expect(s.problems[0]).toMatch(/not the Time Tracking sheet/)
  })
})
