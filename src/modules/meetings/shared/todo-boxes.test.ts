import { describe, expect, it } from 'vitest'
import { checkTodoConversion, convertTodoBoxes, tickTodo, todoLineToBoxes } from './todo-boxes'
import { parseTodos } from './todos'

describe('todoLineToBoxes', () => {
  it('makes a checkbox of a plain TODO line', () => {
    expect(todoLineToBoxes('**TODO(EO)**: write it up')).toEqual([
      '- [ ] **TODO(EO)**: write it up'
    ])
  })
  it('keeps the bullet and the indent', () => {
    expect(todoLineToBoxes('  * **TODO**: a')).toEqual(['  * [ ] **TODO**: a'])
    expect(todoLineToBoxes('2. TODO(KR): b')).toEqual(['2. [ ] TODO(KR): b'])
  })
  it('gives each TODO on one line a checkbox, with the lead-in on the first', () => {
    expect(todoLineToBoxes('Next: **TODO(EO)**: a **TODO(KR)**: b')).toEqual([
      '- [ ] Next: **TODO(EO)**: a',
      '- [ ] **TODO(KR)**: b'
    ])
  })
  it('leaves alone what is not a plain TODO line', () => {
    for (const line of [
      '- [ ] **TODO**: done already',
      '- [x] **TODO**: ticked',
      '## TODO: heading',
      '> **TODO**: quoted',
      '| **TODO**: | cell |',
      'Use `TODO:` in notes',
      'Nothing here'
    ])
      expect(todoLineToBoxes(line)).toBeNull()
  })
})

describe('convertTodoBoxes', () => {
  const body = [
    '## Notes',
    '**TODO(EO)**: one',
    '```',
    '**TODO**: in code',
    '```',
    '- [x] **TODO**: ticked',
    'a **TODO(AC)**: two **TODO(KR)**: three',
    ''
  ].join('\r\n')

  it('converts only prose lines, keeping the line break style', () => {
    const r = convertTodoBoxes(body)
    expect(r.converted.map((c) => c.line)).toEqual([1, 6])
    expect(r.body).toBe(
      [
        '## Notes',
        '- [ ] **TODO(EO)**: one',
        '```',
        '**TODO**: in code',
        '```',
        '- [x] **TODO**: ticked',
        '- [ ] a **TODO(AC)**: two',
        '- [ ] **TODO(KR)**: three',
        ''
      ].join('\r\n')
    )
  })
  it('reads back as the same TODOs and passes its own check', () => {
    const r = convertTodoBoxes(body)
    expect(parseTodos(r.body).map((t) => [t.owners, t.text, t.done])).toEqual(
      parseTodos(body).map((t) => [t.owners, t.text, t.done])
    )
    expect(checkTodoConversion(body, r.body)).toEqual([])
  })
  it('does nothing the second time', () => {
    const once = convertTodoBoxes(body).body
    expect(convertTodoBoxes(once)).toEqual({ body: once, converted: [] })
  })
  it('the check notices a lost TODO and a changed line', () => {
    expect(checkTodoConversion('**TODO**: a\nb', '- [ ] **TODO**: a\nb')).toEqual([])
    expect(checkTodoConversion('**TODO**: a\nb', '- [ ] **TODO**: x\nb')).not.toEqual([])
    expect(checkTodoConversion('**TODO**: a\nb', '- [ ] **TODO**: a\nc')).not.toEqual([])
    expect(checkTodoConversion('- [x] **TODO**: a', '- [ ] **TODO**: a')).not.toEqual([])
  })
})

describe('tickTodo', () => {
  it('ticks a checkbox', () => {
    expect(
      tickTodo('- [ ] **TODO(EO)**: a\n- [ ] **TODO(KR)**: b\n', { owners: ['KR'], text: 'b' })
    ).toBe('- [ ] **TODO(EO)**: a\n- [x] **TODO(KR)**: b\n')
  })
  it('turns a plain TODO into a ticked checkbox, touching nothing else', () => {
    expect(tickTodo('Intro\r\n**TODO(EO)**: a\r\nOutro', { owners: ['EO'], text: 'a' })).toBe(
      'Intro\r\n- [x] **TODO(EO)**: a\r\nOutro'
    )
  })
  it('ticks only its own TODO when a line holds several', () => {
    expect(tickTodo('**TODO(EO)**: a **TODO(KR)**: b', { owners: ['KR'], text: 'b' })).toBe(
      '- [ ] **TODO(EO)**: a\n- [x] **TODO(KR)**: b'.replace('\n', '\n')
    )
  })
  it('ticks every copy, including a previous TODO without TODO syntax', () => {
    const body = '## Previous TODOs\n- [ ] send the form\n## Notes\n**TODO**: send the form.\n'
    expect(tickTodo(body, { owners: [], text: 'send the form' })).toBe(
      '## Previous TODOs\n- [x] send the form\n## Notes\n- [x] **TODO**: send the form.\n'
    )
  })
  it('is null when the TODO is gone or already ticked', () => {
    expect(tickTodo('- [x] **TODO**: a', { owners: [], text: 'a' })).toBeNull()
    expect(tickTodo('nothing', { owners: [], text: 'a' })).toBeNull()
  })
})
