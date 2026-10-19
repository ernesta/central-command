import { describe, expect, it } from 'vitest'
import {
  applyCompletion,
  completionAt,
  ghostFor,
  isFinishedValue,
  type Completion,
  type UserValues
} from './search-complete'

const at = (text: string, user: UserValues = {}): Completion | null =>
  completionAt(text, text.length, user)
const labels = (text: string, user: UserValues = {}): string[] =>
  at(text, user)?.options.map((o) => o.label) ?? []

describe('completionAt: names', () => {
  it('offers the modifiers a word starts like, from two letters', () => {
    expect(labels('wi')).toEqual(['with:'])
    expect(labels('wo')).toEqual(['workspace:'])
    expect(labels('s')).toEqual([])
    expect(labels('st')).toEqual(['status:'])
    expect(labels('zz')).toEqual([])
  })

  it('works after other words and after a minus, and replaces only the word', () => {
    const c = at('experiments -st')
    expect(c).toMatchObject({ from: 12, to: 15, kind: 'name' })
    expect(c?.options[0].insert).toBe('-status:')
  })

  it('offers nothing for a space or an empty word', () => {
    expect(at('')).toBeNull()
    expect(at('in:tasks ')).toBeNull()
  })

  it('finishes the word the caret is in even with text after it', () => {
    const c = completionAt('st x', 2)
    expect(c).toMatchObject({ from: 0, to: 2 })
    expect(c && applyCompletion('st x', c, c.options[0])).toEqual({
      text: 'status: x',
      caret: 7
    })
  })
})

describe('completionAt: values', () => {
  it('lists the fixed values straight after the colon', () => {
    expect(labels('in:')).toEqual([
      'tasks',
      'notes',
      'meetings',
      'training',
      'readings',
      'lists',
      'people'
    ])
    expect(labels('priority:')).toEqual(['P1', 'P2', 'P3'])
    expect(labels('workspace:')).toEqual(['research', 'work', 'life'])
    expect(labels('due:')).toEqual(['today', 'tomorrow', 'overdue', 'week'])
  })

  it('narrows as the value is typed, starts first', () => {
    expect(labels('in:m')).toEqual(['meetings'])
    expect(labels('status:o')[0]).toBe('open')
    expect(labels('status:pro')).toEqual(['in progress'])
  })

  it('inserts values with spaces in quotes, with the minus kept', () => {
    const c = at('-status:in')
    expect(c?.options.map((o) => o.insert)).toEqual(['-status:"in progress"'])
  })

  it('offers dates and periods by their words', () => {
    expect(labels('on:')).toEqual(['today', 'yesterday'])
    expect(labels('during:th').slice(0, 3)).toEqual(['this week', 'this month', 'this year'])
    expect(labels('during:la')).toEqual(['last week', 'last month', 'last year'])
  })

  it('offers the user’s own values for people, lists, tags, skills and series', () => {
    const user: UserValues = {
      with: [{ label: 'Chris Cummiskey', insert: '"Chris Cummiskey"', hint: 'CC' }],
      list: [{ label: 'Luminos', insert: 'Luminos' }]
    }
    expect(labels('with:', user)).toEqual(['Chris Cummiskey'])
    expect(labels('with:cum', user)).toEqual(['Chris Cummiskey'])
    expect(labels('list:lu', user)).toEqual(['Luminos'])
    expect(labels('tag:', user)).toEqual([])
    expect(at('with:chr', user)?.options[0].insert).toBe('with:"Chris Cummiskey"')
  })

  it('does not offer a list for a word that is not a modifier, or once the value is complete', () => {
    expect(at('foo:b')).toBeNull()
    expect(at('in:tasks')).toBeNull()
    expect(at('priority:p1')).toBeNull()
  })

  it('handles a quoted value being typed', () => {
    expect(labels('status:"in')).toEqual(['in progress'])
    expect(at('status:"in progress"')).toBeNull()
  })
})

describe('applyCompletion', () => {
  it('replaces the word, and adds a space after a value', () => {
    const c = at('luminos in:m')!
    expect(applyCompletion('luminos in:m', c, c.options[0])).toEqual({
      text: 'luminos in:meetings ',
      caret: 20
    })
  })
  it('puts the caret right after a modifier’s name', () => {
    const c = at('wor')!
    expect(applyCompletion('wor', c, c.options[0])).toEqual({ text: 'workspace:', caret: 10 })
  })
})

describe('isFinishedValue', () => {
  const people = [
    { label: 'Ernesta Orlovaitė', insert: '"Ernesta Orlovaitė"', hint: 'EO' },
    { label: 'Ernest Smith', insert: '"Ernest Smith"', hint: 'ES' }
  ]
  const done = (modifier: Parameters<typeof isFinishedValue>[0], raw: string): boolean =>
    isFinishedValue(modifier, raw, modifier === 'with' ? people : [], '2026-10-19')

  it('is finished for a quoted value with its closing quote', () => {
    expect(done('with', '"Ernesta Orlovaitė"')).toBe(true)
    expect(done('tag', '"a b"')).toBe(true)
  })

  it('is not finished while the quote is open or the value is a prefix being typed', () => {
    expect(done('with', '"Ernesta')).toBe(false)
    expect(done('with', 'Ern')).toBe(false)
    expect(done('workspace', 're')).toBe(false)
    expect(done('in', 'meet')).toBe(false)
    expect(done('status', '')).toBe(false)
  })

  it('is finished for a value the modifier accepts as it stands, in any listed spelling', () => {
    expect(done('in', 'meetings')).toBe(true)
    expect(done('in', 'meeting')).toBe(true)
    expect(done('workspace', 'Research')).toBe(true)
    expect(done('status', 'done')).toBe(true)
    expect(done('before', '2026-10-01')).toBe(true)
    expect(done('before', 'today')).toBe(true)
  })

  it('is finished for the exact name or initials of one of the user\u2019s own values', () => {
    expect(done('with', 'ernesta orlovaite')).toBe(true)
    expect(done('with', 'EO')).toBe(true)
  })

  it('does not take a person for finished just because the parser accepts any text', () => {
    expect(done('with', 'zzz')).toBe(false)
  })
})

describe('completionAt: finished values', () => {
  it('opens no list over a complete value', () => {
    expect(at('in:meetings')).toBeNull()
    expect(at('in:meeting')).toBeNull()
    expect(at('workspace:work')).toBeNull()
    const user: UserValues = {
      with: [{ label: 'Ernesta Orlovaitė', insert: '"Ernesta Orlovaitė"', hint: 'EO' }]
    }
    expect(at('with:"Ernesta Orlovaitė"', user)).toBeNull()
    expect(at('with:EO', user)).toBeNull()
  })

  it('still opens it while the value is empty or a prefix', () => {
    expect(at('in:')).not.toBeNull()
    expect(at('workspace:re')).not.toBeNull()
    expect(at('with:Ern', { with: [{ label: 'Ernesta Orlovaitė', insert: 'x' }] })).not.toBeNull()
  })
})

describe('ghostFor', () => {
  const user: UserValues = {
    with: [
      { label: 'Ernesta Orlovaitė', insert: '"Ernesta Orlovaitė"', hint: 'EO' },
      { label: 'Kathy Rastle', insert: '"Kathy Rastle"', hint: 'KR' }
    ]
  }
  const ghost = (text: string, caret = text.length): string =>
    ghostFor(text, caret, completionAt(text, caret, user))

  it('greys out the rest of the one value that matches', () => {
    expect(ghost('workspace:re')).toBe('search')
    expect(ghost('with:Ern')).toBe('esta Orlovaitė')
    expect(ghost('with:"kat')).toBe('hy Rastle')
    expect(ghost('-workspace:w')).toBe('ork')
  })

  it('greys out the rest of a modifier name when only one starts so', () => {
    expect(ghost('wo')).toBe('rkspace:')
    expect(ghost('st')).toBe('atus:')
    expect(ghost('experiments -wor')).toBe('kspace:')
  })

  it('shows nothing with two or more matches', () => {
    expect(ghost('workspace:')).toBe('')
    expect(ghost('in:t')).toBe('')
    expect(ghost('with:e')).toBe('')
  })

  it('shows nothing when the caret is not at the end, nothing is typed to continue, or the value is finished', () => {
    expect(ghost('workspace:re x', 12)).toBe('')
    expect(ghost('workspace:research')).toBe('')
    expect(ghost('person:x')).toBe('')
    expect(ghost('hello')).toBe('')
  })

  it('shows nothing for a match inside the label rather than at its start', () => {
    expect(ghost('with:rastl')).toBe('')
  })
})
