import { describe, expect, it } from 'vitest'
import { parseActivityLog } from './work-logs'

const OLD = `October 2025 Activity Log
Date: October 28, 2025
This activity log summarises the consulting work completed during October 2025. More specifically, with the contract specifying the level of effort at 1 day per week, the log covers the four full weeks between October 1 and October 28, 2025.
Activity
Time
Meetings, meeting note synthesis
3.25 h
Luminos Existing Data System Audit (drafting)

Core Program Data
5.50 h
Monthly Activity Log: October
0.25 h
Total
9.00 h
`

const SECTIONED = `June 2026 Activity Log
This activity log summarises the work. More specifically, the log covers the five weeks between May 29, 2026, and July 2, 2026.
Activity
Time (h)
Impact – Total\t
1.75
Meeting with Matthew
1.00
Monthly Activity Log: June
0.75
Teaching & Learning – Total
0.50
Document automation
0.50
Total
2.25
`

describe('parseActivityLog', () => {
  it('reads the period, the lines and the total of an older log (a heading with no hours is not a line)', () => {
    const l = parseActivityLog('2025 10 Activity Log', OLD)
    expect(l.problems).toEqual([])
    expect([l.month, l.from, l.to]).toEqual(['2025-10', '2025-10-01', '2025-10-28'])
    expect(l.entries.map((e) => [e.label, e.minutes, e.client])).toEqual([
      ['Meetings, meeting note synthesis', 195, null],
      ['Core Program Data', 330, null],
      ['Monthly Activity Log: October', 15, null]
    ])
    expect(l.totals).toEqual({ impact: null, teaching: null, total: 540 })
  })

  it('reads sections whose total comes first, with hours that have no "h"', () => {
    const l = parseActivityLog('2026 06 Activity Log', SECTIONED)
    expect(l.problems).toEqual([])
    expect([l.from, l.to]).toEqual(['2026-05-29', '2026-07-02'])
    expect(l.totals).toEqual({ impact: 105, teaching: 30, total: 135 })
    expect(l.entries.map((e) => [e.minutes, e.client])).toEqual([
      [60, 'Impact'],
      [45, 'Impact'],
      [30, 'Teaching & Learning']
    ])
  })

  it('reads a period that crosses the new year', () => {
    const l = parseActivityLog(
      '2026 01 Activity Log',
      OLD.replace(
        'between October 1 and October 28, 2025',
        'between December 31, 2025, and February 3, 2026'
      )
    )
    expect([l.from, l.to]).toEqual(['2025-12-31', '2026-02-03'])
  })

  it('reports lines that do not add up to the total, a missing period and a missing total', () => {
    expect(
      parseActivityLog('2025 10 Activity Log', OLD.replace('9.00 h', '9.25 h')).problems.join()
    ).toMatch(/lines add up to 540 min, the total says 555/)
    expect(
      parseActivityLog(
        '2026 06 Activity Log',
        SECTIONED.replace('Teaching & Learning – Total\n0.50', 'Teaching & Learning – Total\n0.75')
      ).problems.join()
    ).toMatch(/Teaching & Learning lines add up to 30 min, its total says 45/)
    expect(
      parseActivityLog('2025 10 Activity Log', OLD.replace(/between.*\./, '')).problems.join()
    ).toMatch(/no period/)
    expect(
      parseActivityLog('2025 10 Activity Log', OLD.replace('Total\n9.00 h\n', '')).problems.join()
    ).toMatch(/no total/)
  })
})
