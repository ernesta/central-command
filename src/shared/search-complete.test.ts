import { describe, expect, it } from 'vitest'
import { applyCompletion, completionAt, type Completion, type UserValues } from './search-complete'

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
