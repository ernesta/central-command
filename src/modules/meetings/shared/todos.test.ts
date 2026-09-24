import { describe, expect, it } from 'vitest'
import {
  formatTodoLine,
  normaliseTodoText,
  ownedBy,
  parseOwners,
  parseTodos,
  resolveOwner,
  sameTodo
} from './todos'
import type { Person } from './types'

const inline = (body: string): { owners: string[]; text: string; done: boolean }[] =>
  parseTodos(body).map(({ owners, text, done }) => ({ owners, text, done }))

describe('parseTodos: the accepted syntax', () => {
  it.each([
    ['**TODO(EO)**: Re-run the models', ['EO']],
    ['**TODO (EO)**: Re-run the models', ['EO']],
    ['**TODO(EO):** Re-run the models', ['EO']],
    ['TODO(EO): Re-run the models', ['EO']],
    ['TODO (EO): Re-run the models', ['EO']],
    ['**TODO(KR & AC)**: Re-run the models', ['KR', 'AC']],
    ['TODO(KR & AC): Re-run the models', ['KR', 'AC']],
    ['**TODO(KR, AC)**: Re-run the models', ['KR', 'AC']],
    ['**TODO(kr and ac)**: Re-run the models', ['KR', 'AC']],
    ['**TODO**: Re-run the models', []],
    ['**TODO:** Re-run the models', []],
    ['TODO: Re-run the models', []],
    ['**TODO(EO)** : Re-run the models', ['EO']]
  ])('reads %s', (line, owners) => {
    expect(inline(line)).toEqual([{ owners, text: 'Re-run the models', done: false }])
  })

  it('finds a TODO anywhere on a line, in lists, quotes and headings', () => {
    expect(inline('- **TODO(EO)**: a')).toHaveLength(1)
    expect(inline('    - nested **TODO(EO)**: a')).toHaveLength(1)
    expect(inline('> **TODO(EO)**: a')).toHaveLength(1)
    expect(inline('1. **TODO(EO)**: a')).toHaveLength(1)
    expect(inline('Then we agreed. **TODO(EO)**: a')[0].text).toBe('a')
    expect(inline('### TODO(EO): a')[0].text).toBe('a')
  })

  it('keeps the text exactly as written, Markdown included', () => {
    expect(inline('**TODO(EO)**: Send **the** [plan](http://x.y) `now`   ')[0].text).toBe(
      'Send **the** [plan](http://x.y) `now`'
    )
  })

  it('gives each marker on a line the text up to the next marker', () => {
    expect(inline('**TODO(EO)**: first **TODO(KR)**: second')).toEqual([
      { owners: ['EO'], text: 'first', done: false },
      { owners: ['KR'], text: 'second', done: false }
    ])
  })

  it('ignores lookalikes', () => {
    expect(inline('TODOs: things')).toEqual([])
    expect(inline('MYTODO(EO): x')).toEqual([])
    expect(inline('todo(EO): x')).toEqual([])
    expect(inline('**TODO(EO)** no colon')).toEqual([])
    expect(inline('a TODO list')).toEqual([])
    expect(inline('**TODO(EO)**:')).toEqual([])
    expect(inline('**TODO(EO)**:   ')).toEqual([])
  })

  it('ignores TODOs inside inline code and fenced code', () => {
    expect(inline('Write `**TODO(EO)**: x` like this')).toEqual([])
    expect(inline('```\n**TODO(EO)**: x\n```\n**TODO(KR)**: y')).toEqual([
      { owners: ['KR'], text: 'y', done: false }
    ])
  })

  it('reads CRLF notes', () => {
    expect(inline('- **TODO(EO)**: a\r\n- **TODO(KR)**: b\r\n').map((t) => t.text)).toEqual([
      'a',
      'b'
    ])
  })

  it('treats a ticked checkbox as done, wherever it is', () => {
    expect(inline('- [x] **TODO(EO)**: a\n- [ ] **TODO(EO)**: b\n- [X] TODO: c')).toEqual([
      { owners: ['EO'], text: 'a', done: true },
      { owners: ['EO'], text: 'b', done: false },
      { owners: [], text: 'c', done: true }
    ])
  })

  it('records the kind and line number', () => {
    const items = parseTodos('## Notes\n\ntext\n- **TODO(EO)**: a\n')
    expect(items).toEqual([{ kind: 'inline', owners: ['EO'], text: 'a', done: false, line: 3 }])
  })
})

describe('parseTodos: Previous TODOs', () => {
  const body = [
    '## Summary',
    '',
    '- [ ] **TODO(EO)**: not a previous item',
    '',
    '## Previous TODOs',
    '',
    '- [x] **TODO(EO)**: Start writing up',
    '- [ ] **TODO(KR)**: Send the contact details',
    '- [ ] Plain old checkbox',
    '- [x] Ticked plain',
    '- not a checkbox',
    'A **TODO(AC)**: loose line',
    '',
    '## Notes',
    '',
    '- [ ] **TODO(EO)**: inline in notes'
  ].join('\n')

  it('reads checkbox items under the heading as previous items, ticked or not', () => {
    const previous = parseTodos(body).filter((t) => t.kind === 'previous')
    expect(previous.map(({ owners, text, done }) => ({ owners, text, done }))).toEqual([
      { owners: ['EO'], text: 'Start writing up', done: true },
      { owners: ['KR'], text: 'Send the contact details', done: false },
      { owners: [], text: 'Plain old checkbox', done: false },
      { owners: [], text: 'Ticked plain', done: true }
    ])
  })

  it('reads TODOs elsewhere as inline, including loose lines in the Previous TODOs section', () => {
    const inlineItems = parseTodos(body).filter((t) => t.kind === 'inline')
    expect(inlineItems.map((t) => t.text)).toEqual([
      'not a previous item',
      'loose line',
      'inline in notes'
    ])
  })

  it('stops being the previous section at the next heading of level 2 or 1, not level 3', () => {
    const items = parseTodos('## Previous TODOs\n### sub\n- [ ] a\n# Top\n- [ ] b\n')
    expect(items.map((t) => [t.kind, t.text])).toEqual([['previous', 'a']])
  })

  it('ignores a Previous TODOs heading inside a code fence', () => {
    expect(parseTodos('```\n## Previous TODOs\n```\n- [ ] a')).toEqual([])
  })

  it('a previous item whose marker is not at the start is kept whole, without an owner', () => {
    expect(parseTodos('## Previous TODOs\n- [ ] Send the file **TODO(EO)**: soon')).toEqual([
      {
        kind: 'previous',
        owners: [],
        text: 'Send the file **TODO(EO)**: soon',
        done: false,
        line: 1
      }
    ])
  })
})

describe('owners', () => {
  it('parseOwners splits, trims and upper-cases', () => {
    expect(parseOwners('kr & ac')).toEqual(['KR', 'AC'])
    expect(parseOwners(' EO ')).toEqual(['EO'])
    expect(parseOwners('')).toEqual([])
    expect(parseOwners(undefined)).toEqual([])
  })

  const people: Person[] = [
    { name: 'Kathy Rastle', initials: 'KR', me: false },
    { name: 'Arnaud Chevalier', initials: 'AC', me: false },
    { name: 'Ernesta Orlovaitė', initials: 'EO', me: true },
    { name: 'Matthew Jukes', initials: 'MJ', me: false }
  ]

  it('resolves against the attendees first, then everyone, else flags unknown', () => {
    const attendees = ['Kathy Rastle', 'Ernesta Orlovaitė']
    expect(resolveOwner('KR', attendees, people)).toMatchObject({
      source: 'attendee',
      person: { name: 'Kathy Rastle' }
    })
    expect(resolveOwner('mj', attendees, people)).toMatchObject({
      source: 'people',
      person: { name: 'Matthew Jukes' }
    })
    expect(resolveOwner('ZZ', attendees, people)).toEqual({
      initials: 'ZZ',
      person: null,
      source: 'unknown'
    })
  })

  it('an attendee not in the people list does not break resolution', () => {
    expect(resolveOwner('EO', ['Somebody Else'], people).source).toBe('people')
  })

  it('ownedBy matches any of several owners, ignoring case', () => {
    expect(ownedBy({ owners: ['KR', 'AC'] }, 'ac')).toBe(true)
    expect(ownedBy({ owners: ['KR'] }, 'EO')).toBe(false)
    expect(ownedBy({ owners: [] }, '')).toBe(false)
  })
})

describe('sameTodo and formatting', () => {
  it('ignores case, emphasis, spacing and a final full stop', () => {
    expect(normaliseTodoText('  Send  **the** Plan. ')).toBe('send the plan')
    expect(
      sameTodo(
        { owners: ['EO'], text: 'Send the plan' },
        { owners: ['EO'], text: 'send  the  *plan*.' }
      )
    ).toBe(true)
  })
  it('needs the same owners, in any order, unless one side has none', () => {
    const t = 'Send the plan'
    expect(sameTodo({ owners: ['EO'], text: t }, { owners: ['KR'], text: t })).toBe(false)
    expect(sameTodo({ owners: ['KR', 'AC'], text: t }, { owners: ['AC', 'KR'], text: t })).toBe(
      true
    )
    expect(sameTodo({ owners: ['KR', 'AC'], text: t }, { owners: ['KR'], text: t })).toBe(false)
    expect(sameTodo({ owners: [], text: t }, { owners: ['KR'], text: t })).toBe(true)
  })
  it('different text is a different TODO', () => {
    expect(sameTodo({ owners: ['EO'], text: 'a' }, { owners: ['EO'], text: 'b' })).toBe(false)
  })
  it('writes the checkbox line in the standard form, which parses back', () => {
    expect(formatTodoLine({ owners: ['EO'], text: 'Send **it**' })).toBe(
      '- [ ] **TODO(EO)**: Send **it**'
    )
    expect(formatTodoLine({ owners: ['KR', 'AC'], text: 'x' })).toBe('- [ ] **TODO(KR & AC)**: x')
    expect(formatTodoLine({ owners: [], text: 'x' })).toBe('- [ ] **TODO**: x')
    for (const owners of [['EO'], ['KR', 'AC'], []]) {
      const line = formatTodoLine({ owners, text: 'Some text' })
      expect(inline(line)).toEqual([{ owners, text: 'Some text', done: false }])
    }
  })
})
