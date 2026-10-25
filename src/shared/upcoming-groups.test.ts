import { describe, expect, it } from 'vitest'
import { groupByUpcoming, layoutRows } from './upcoming-groups'

const today = '2026-10-25'
const row = (date: string, id = date): { date: string; id: string } => ({ date, id })
const upcoming = (r: { date: string }): boolean => r.date === '' || r.date > today
const ids = (rows: { id: string }[]): string[] => rows.map((r) => r.id)

describe('groupByUpcoming', () => {
  it('splits into Upcoming then Earlier, keeping the list order inside each', () => {
    const rows = [row('2026-12-01'), row('2026-11-01'), row('2026-10-20'), row('2026-10-01')]
    const groups = groupByUpcoming(rows, upcoming)
    expect(groups.map((g) => [g.label, ids(g.rows)])).toEqual([
      ['Upcoming', ['2026-12-01', '2026-11-01']],
      ['Earlier', ['2026-10-20', '2026-10-01']]
    ])
  })

  it('puts undated rows first in Upcoming, wherever they were in the input', () => {
    const rows = [row('2026-11-01'), row('', 'a'), row('2026-10-01'), row('', 'b')]
    const [first] = groupByUpcoming(rows, upcoming)
    expect(first.label).toBe('Upcoming')
    expect(ids(first.rows)).toEqual(['a', 'b', '2026-11-01'])
  })

  it('leaves out an empty group', () => {
    expect(groupByUpcoming([row('2026-10-01')], upcoming).map((g) => g.key)).toEqual(['earlier'])
    expect(groupByUpcoming([row('')], upcoming).map((g) => g.key)).toEqual(['upcoming'])
    expect(groupByUpcoming([], upcoming)).toEqual([])
  })

  it('counts today as earlier', () => {
    expect(groupByUpcoming([row(today)], upcoming).map((g) => g.key)).toEqual(['earlier'])
  })
})

describe('layoutRows', () => {
  const rows = [row('2026-10-01', 'old'), row('', 'none'), row('2026-11-01', 'soon')]
  it('draws the groups in order, with where each starts', () => {
    const { ordered, groups } = layoutRows(rows, true, upcoming)
    expect(ids(ordered)).toEqual(['none', 'soon', 'old'])
    expect(groups.map((g) => [g.label, g.start, ids(g.rows)])).toEqual([
      ['Upcoming', 0, ['none', 'soon']],
      ['Earlier', 2, ['old']]
    ])
  })
  it('has one header-less group, in the given order, when not grouped', () => {
    const { ordered, groups } = layoutRows(rows, false, upcoming)
    expect(ids(ordered)).toEqual(['old', 'none', 'soon'])
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBeNull()
  })
})
