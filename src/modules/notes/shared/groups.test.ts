import { describe, expect, it } from 'vitest'
import {
  ALL_GROUPS,
  cleanName,
  deriveGroups,
  filterTitle,
  groupLabel,
  groupOptions,
  isValidName,
  landingGroups,
  matchesGroup,
  normaliseFilter,
  reconcileFilter,
  resolveNames,
  sameFilter
} from './groups'
import type { NoteIndexRow } from './types'

function row(id: string, group = '', subgroup = '', edited = 1): NoteIndexRow {
  return {
    workspace: 'research',
    id,
    title: id,
    group,
    subgroup,
    pinned: false,
    created: '',
    edited,
    firstLine: '',
    excerpt: '',
    problems: [],
    contentHash: 'h'
  }
}

describe('names', () => {
  it('collapses spacing and rejects separators', () => {
    expect(cleanName('  Thesis   chapters ')).toBe('Thesis chapters')
    expect(isValidName('Thesis')).toBe(true)
    expect(isValidName('Thesis/Methods')).toBe(false)
    expect(isValidName('Thesis › Methods')).toBe(false)
    expect(isValidName('   ')).toBe(false)
  })

  it('writes nesting with an arrow', () => {
    expect(groupLabel('Thesis', 'Methods')).toBe('Thesis › Methods')
    expect(groupLabel('Thesis')).toBe('Thesis')
    expect(groupLabel('')).toBe('')
  })
})

describe('resolveNames', () => {
  const rows = [row('a', 'Thesis', 'Methods'), row('b', 'thesis', 'methods')]

  it('uses the first spelling found', () => {
    expect(resolveNames(rows, ' THESIS ', 'METHODS')).toEqual({
      group: 'Thesis',
      subgroup: 'Methods'
    })
  })

  it('keeps new names as typed, and matches a subgroup only inside its group', () => {
    expect(resolveNames(rows, 'Analysis', 'Methods')).toEqual({
      group: 'Analysis',
      subgroup: 'Methods'
    })
    expect(resolveNames(rows, 'thesis', 'New one')).toEqual({
      group: 'Thesis',
      subgroup: 'New one'
    })
  })

  it('has no subgroup without a group', () => {
    expect(resolveNames(rows, '', 'Methods')).toEqual({ group: '', subgroup: '' })
  })
})

describe('deriveGroups', () => {
  it('counts subgroup notes in the group and lists subgroups', () => {
    const groups = deriveGroups([
      row('a', 'Thesis', 'Methods', 5),
      row('b', 'thesis', '', 9),
      row('c', 'Thesis', 'methods', 2),
      row('d', 'Analysis', '', 3),
      row('e')
    ])
    expect(groups).toEqual([
      { name: 'Analysis', count: 1, edited: 3, subgroups: [] },
      { name: 'Thesis', count: 3, edited: 9, subgroups: [{ name: 'Methods', count: 2 }] }
    ])
  })

  it('has no groups when nothing is grouped', () => {
    expect(deriveGroups([row('a')])).toEqual([])
  })
})

describe('matchesGroup', () => {
  const thesis = { scope: 'group', group: 'thesis', subgroup: '' } as const
  const methods = { scope: 'group', group: 'Thesis', subgroup: 'Methods' } as const

  it('includes subgroups when a group is chosen', () => {
    expect(matchesGroup(row('a', 'Thesis', 'Methods'), thesis)).toBe(true)
    expect(matchesGroup(row('a', 'Thesis'), thesis)).toBe(true)
    expect(matchesGroup(row('a', 'Analysis'), thesis)).toBe(false)
  })

  it('shows only the subgroup when one is chosen', () => {
    expect(matchesGroup(row('a', 'Thesis', 'Methods'), methods)).toBe(true)
    expect(matchesGroup(row('a', 'Thesis', 'Intro'), methods)).toBe(false)
    expect(matchesGroup(row('a', 'Thesis'), methods)).toBe(false)
  })

  it('handles all and ungrouped', () => {
    expect(matchesGroup(row('a', 'Thesis'), ALL_GROUPS)).toBe(true)
    expect(matchesGroup(row('a'), { scope: 'ungrouped' })).toBe(true)
    expect(matchesGroup(row('a', 'Thesis'), { scope: 'ungrouped' })).toBe(false)
  })

  it('titles the page after the filter', () => {
    expect(filterTitle(ALL_GROUPS)).toBeNull()
    expect(filterTitle({ scope: 'ungrouped' })).toBe('Ungrouped')
    expect(filterTitle(methods)).toBe('Thesis › Methods')
    expect(sameFilter(thesis, { ...thesis, group: 'THESIS' })).toBe(true)
    expect(sameFilter(thesis, methods)).toBe(false)
  })
})

describe('selector and remembered filter', () => {
  const groups = deriveGroups([row('a', 'Thesis', 'Methods'), row('b', 'Analysis')])

  it('lists each group followed by its subgroups', () => {
    expect(groupOptions(groups).map((o) => [o.label, o.depth, o.count])).toEqual([
      ['Analysis', 0, 1],
      ['Thesis', 0, 1],
      ['Thesis › Methods', 1, 1]
    ])
  })

  it('reads a remembered filter leniently', () => {
    expect(normaliseFilter(null)).toEqual(ALL_GROUPS)
    expect(normaliseFilter({ scope: 'group', group: 5 })).toEqual(ALL_GROUPS)
    expect(normaliseFilter({ scope: 'group', group: ' Thesis ' })).toEqual({
      scope: 'group',
      group: 'Thesis',
      subgroup: ''
    })
  })

  it('drops a remembered group that no longer exists', () => {
    expect(reconcileFilter({ scope: 'group', group: 'gone', subgroup: '' }, groups)).toEqual(
      ALL_GROUPS
    )
    expect(reconcileFilter({ scope: 'group', group: 'thesis', subgroup: 'gone' }, groups)).toEqual(
      ALL_GROUPS
    )
    expect(
      reconcileFilter({ scope: 'group', group: 'thesis', subgroup: 'methods' }, groups)
    ).toEqual({ scope: 'group', group: 'Thesis', subgroup: 'Methods' })
  })
})

describe('landingGroups', () => {
  it('shows all groups as cards when there are few', () => {
    const { cards, more } = landingGroups([
      row('a', 'A', '', 3),
      row('b', 'B', '', 5),
      row('c', '', '', 1)
    ])
    expect(cards.map((c) => (c.kind === 'group' ? c.group.name : 'Ungrouped'))).toEqual([
      'B',
      'A',
      'Ungrouped'
    ])
    expect(more).toEqual([])
  })

  it('shows the six most recently edited, with Ungrouped always one of them', () => {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((g, i) => row(g, g, '', 100 - i))
    rows.push(row('loose', '', '', 1))
    const { cards, more } = landingGroups(rows)
    expect(cards).toHaveLength(6)
    expect(cards[5].kind).toBe('ungrouped')
    expect(cards.slice(0, 5).map((c) => c.kind === 'group' && c.group.name)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E'
    ])
    expect(more.map((g) => g.name)).toEqual(['F', 'G', 'H'])
  })

  it('uses all six slots for groups when nothing is ungrouped', () => {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((g, i) => row(g, g, '', 100 - i))
    const { cards, more } = landingGroups(rows)
    expect(cards).toHaveLength(6)
    expect(more.map((g) => g.name)).toEqual(['G'])
  })
})
