import { describe, expect, it } from 'vitest'
import {
  PICKER_SEARCH_MIN,
  defaultActive,
  hasExactMatch,
  hasSearch,
  highlightRanges,
  matchOptions,
  orderOptions,
  typeAhead,
  usedValueOptions,
  type PickerOption
} from './picker-match'

const o = (label: string, extra: Partial<PickerOption> = {}): PickerOption => ({
  value: label,
  label,
  ...extra
})

describe('hasSearch', () => {
  it('offers a search field only past seven options', () => {
    expect(PICKER_SEARCH_MIN).toBe(7)
    expect(hasSearch(7)).toBe(false)
    expect(hasSearch(8)).toBe(true)
    expect(hasSearch(2, true)).toBe(true)
  })
})

describe('orderOptions', () => {
  it('lists ungrouped options first, then each group in turn', () => {
    const list = [o('a', { group: 'G' }), o('b'), o('c', { group: 'H' }), o('d', { group: 'G' })]
    expect(orderOptions(list).map((x) => x.label)).toEqual(['b', 'a', 'd', 'c'])
  })
})

describe('matchOptions', () => {
  const list = [
    o('Workshop'),
    o('Müller seminar'),
    o('Lecture', { description: 'Taught by a visiting speaker' }),
    o('Group', { keywords: 'cohort' })
  ]
  it('keeps everything for an empty query', () => {
    expect(matchOptions(list, '  ')).toHaveLength(4)
  })
  it('ignores case and accents', () => {
    expect(matchOptions(list, 'MULLER').map((x) => x.label)).toEqual(['Müller seminar'])
  })
  it('looks in the description and the keywords, and wants every word', () => {
    expect(matchOptions(list, 'visiting').map((x) => x.label)).toEqual(['Lecture'])
    expect(matchOptions(list, 'cohort').map((x) => x.label)).toEqual(['Group'])
    expect(matchOptions(list, 'visiting speaker').map((x) => x.label)).toEqual(['Lecture'])
    expect(matchOptions(list, 'visiting nobody')).toEqual([])
  })
})

describe('highlightRanges', () => {
  it('marks where the words sit in the label', () => {
    expect(highlightRanges('Summer School', 'sch')).toEqual([[7, 10]])
    expect(highlightRanges('Summer School', 'su sc')).toEqual([
      [0, 2],
      [7, 9]
    ])
  })
  it('merges overlaps and finds repeats', () => {
    expect(highlightRanges('banana', 'an')).toEqual([[1, 5]])
  })
  it('counts in the label’s own characters when folding changes the length', () => {
    expect(highlightRanges('Straße', 'ss')).toEqual([[4, 5]])
    expect(highlightRanges('Müller', 'mul')).toEqual([[0, 3]])
  })
  it('is empty for an empty query or no hit', () => {
    expect(highlightRanges('abc', '')).toEqual([])
    expect(highlightRanges('abc', 'z')).toEqual([])
  })
})

describe('typeAhead', () => {
  const list = [o('Apple'), o('Banana'), o('blueberry'), o('Çedilla')]
  it('finds the first option starting with the letters', () => {
    expect(typeAhead(list, 'b')).toBe(1)
    expect(typeAhead(list, 'blu')).toBe(2)
    expect(typeAhead(list, 'c')).toBe(3)
  })
  it('finds nothing for nothing or a miss', () => {
    expect(typeAhead(list, '')).toBe(-1)
    expect(typeAhead(list, 'z')).toBe(-1)
    expect(typeAhead(list, 'ana')).toBe(-1)
  })
})

describe('hasExactMatch', () => {
  it('is true only for the whole label, whatever the case', () => {
    const list = [o('Summer School')]
    expect(hasExactMatch(list, ' summer school ')).toBe(true)
    expect(hasExactMatch(list, 'Summer')).toBe(false)
  })
  it('does not count a nested option, which is a sub-item and not the same value', () => {
    expect(hasExactMatch([o('Methods', { nested: true })], 'methods')).toBe(false)
  })
})

describe('defaultActive', () => {
  const list = [o('Alpha'), o('Beta'), o('Alphabet')]
  it('starts on the current value when nothing is typed', () => {
    expect(defaultActive(list, '', { selected: 'Beta', addRow: false })).toBe(1)
    expect(defaultActive(list, '', { selected: null, addRow: false })).toBe(-1)
  })
  it('starts on the first match once something is typed', () => {
    expect(defaultActive([list[0], list[2]], 'alp', { addRow: false })).toBe(0)
    expect(defaultActive([], 'zz', { addRow: false })).toBe(-1)
  })
  it('prefers an exact match', () => {
    expect(defaultActive([list[0], list[2]], 'alphabet', { addRow: false })).toBe(1)
  })
  it('with an Add row: the only match, else the Add row', () => {
    expect(defaultActive([list[0]], 'alp', { addRow: true })).toBe(0)
    expect(defaultActive([list[0], list[2]], 'alp', { addRow: true })).toBe(2)
    expect(defaultActive([], 'zz', { addRow: true })).toBe(0)
  })
})

describe('usedValueOptions', () => {
  it('lists each used value once, sorted, with the current one among them', () => {
    expect(usedValueOptions(['b', 'a', 'b'], 'c').map((x) => x.value)).toEqual(['a', 'b', 'c'])
  })
  it('leads with a row that clears it when there is a word for none', () => {
    expect(usedValueOptions(['a'], '', 'None')).toEqual([
      { value: '', label: 'None' },
      { value: 'a', label: 'a' }
    ])
  })
})
