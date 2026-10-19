import { describe, expect, it } from 'vitest'
import { chipLabel, joinQuery, splitChips } from './search-chips'

const TODAY = '2026-10-19'
const people = new Set(['ernesta orlovaite', 'eo', 'kathy rastle'])
const person = (folded: string): boolean => people.has(folded)
const split = (text: string, complete = false, caret?: number): ReturnType<typeof splitChips> =>
  splitChips(text, { complete, caret, person, today: TODAY })

describe('splitChips', () => {
  it('leaves a modifier alone until the typist is past it', () => {
    expect(split('in:meetings')).toMatchObject({ chips: [], rest: 'in:meetings' })
  })

  it('makes a chip of a finished, valid modifier followed by a space', () => {
    expect(split('in:meetings ')).toMatchObject({ chips: ['in:meetings'], rest: '' })
    expect(split('sample in:meetings workspace:work x')).toMatchObject({
      chips: ['in:meetings', 'workspace:work'],
      rest: 'sample x'
    })
  })

  it('takes the last word too when told the text ends there (a paste, Enter)', () => {
    expect(split('by:"Kathy Rastle"', true)).toMatchObject({
      chips: ['by:"Kathy Rastle"'],
      rest: ''
    })
  })

  it('keeps the minus on a negated chip', () => {
    expect(split('-tag:x ')).toMatchObject({ chips: ['-tag:x'], rest: '' })
    expect(chipLabel('-tag:x')).toBe('-tag:x')
  })

  it('shows a quoted value without the quotes', () => {
    expect(chipLabel('with:"Ernesta Orlovaitė"')).toBe('with:Ernesta Orlovaitė')
  })

  it('keeps as text what is not yet complete or valid', () => {
    for (const text of [
      'in: ',
      'person:kathy ',
      'in:home ',
      'with:"Ernesta ',
      'with:Zzz ',
      'before:soon '
    ]) {
      expect(split(text).chips, text).toEqual([])
    }
    expect(split('with:"Ernesta', true).chips).toEqual([])
  })

  it('makes a chip of a person only when the person is in the list (name or initials)', () => {
    expect(split('with:EO ').chips).toEqual(['with:EO'])
    expect(split('with:"Ernesta Orlovaitė" ').chips).toEqual(['with:"Ernesta Orlovaitė"'])
  })

  it('does not take an address or a time for a chip', () => {
    expect(split('https://example.org 10:30 ').chips).toEqual([])
  })

  it('moves the caret back by what was taken out before it', () => {
    expect(split('in:notes abc', false, 12)).toMatchObject({ rest: 'abc', caret: 3 })
    expect(split('abc in:notes ', false, 13)).toMatchObject({ rest: 'abc ', caret: 4 })
    expect(split('abc in:notes xyz', false, 3)).toMatchObject({ rest: 'abc xyz', caret: 3 })
  })

  it('is stable: splitting the rest again takes nothing more', () => {
    const once = split('a in:notes b -tag:x c ')
    expect(split(once.rest).chips).toEqual([])
  })
})

describe('joinQuery', () => {
  it('puts the chips before the text', () => {
    expect(joinQuery(['in:notes', '-tag:x'], 'sample')).toBe('in:notes -tag:x sample')
    expect(joinQuery([], '  ')).toBe('')
    expect(joinQuery(['in:notes'], '')).toBe('in:notes')
  })
})
