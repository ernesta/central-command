// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { openView, press, show } from './live-key-utils'

/** Open `before`, press `chord`, and return the text with the selection written in. */
function after(before: string, chord: string, times = 1): string {
  const { view } = openView(before)
  for (let i = 0; i < times; i++) expect(press(view, chord), `${chord} is bound`).toBe(true)
  return show(view)
}

describe('Bold, Mod-b', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(after('a |b| c', 'Mod-b')).toBe('a **|b|** c')
  })
  it('takes the markers off again', () => {
    expect(after('a |b| c', 'Mod-b', 2)).toBe('a |b| c')
    expect(after('a **|b|** c', 'Mod-b')).toBe('a |b| c')
  })
  it('marks the word the cursor is in, and unmarks it', () => {
    expect(after('say hel|lo now', 'Mod-b')).toBe('say **hel|lo** now')
    expect(after('say **hel|lo** now', 'Mod-b')).toBe('say hel|lo now')
  })
  it('puts a pair in an empty spot with the cursor between, and removes an empty pair', () => {
    expect(after('a | b', 'Mod-b')).toBe('a **|** b')
    expect(after('a | b', 'Mod-b', 2)).toBe('a | b')
  })
  it('keeps white space at the edges of the selection outside the markers', () => {
    expect(after('x | y | z', 'Mod-b')).toBe('x  **|y|**  z')
  })
  it('does not leave pairs inside pairs when the selection already holds bold text', () => {
    expect(after('|a **b** c|', 'Mod-b')).toBe('**|a b c|**')
  })
  it('unmarks the whole span when the selection is part of it', () => {
    expect(after('**a |b| c**', 'Mod-b')).toBe('a |b| c')
  })
  it('reports the change as it happens', () => {
    const { view, reports } = openView('a |b| c')
    press(view, 'Mod-b')
    expect(reports).toEqual(['a **b** c'])
  })
})

describe('Italic, Mod-i', () => {
  it('wraps and unwraps with one asterisk', () => {
    expect(after('a |b| c', 'Mod-i')).toBe('a *|b|* c')
    expect(after('a |b| c', 'Mod-i', 2)).toBe('a |b| c')
  })
  it('adds italics inside bold, and takes only the italics off', () => {
    expect(after('**a |b| c**', 'Mod-i')).toBe('**a *|b|* c**')
    expect(after('**a *|b|* c**', 'Mod-i')).toBe('**a |b| c**')
  })
  it('marks a word', () => {
    expect(after('one tw|o', 'Mod-i')).toBe('one *tw|o*')
  })
})

describe('Strikethrough, Mod-Alt-x', () => {
  it('wraps and unwraps with two tildes', () => {
    expect(after('a |b| c', 'Mod-Alt-x')).toBe('a ~~|b|~~ c')
    expect(after('a |b| c', 'Mod-Alt-x', 2)).toBe('a |b| c')
  })
  it('marks a word', () => {
    expect(after('one tw|o', 'Mod-Alt-x')).toBe('one ~~tw|o~~')
  })
})

describe('Inline code, Mod-e', () => {
  it('wraps and unwraps with a backtick', () => {
    expect(after('a |b| c', 'Mod-e')).toBe('a `|b|` c')
    expect(after('a |b| c', 'Mod-e', 2)).toBe('a |b| c')
  })
  it('puts a pair in an empty line', () => {
    expect(after('|', 'Mod-e')).toBe('`|`')
  })
})

describe('Headings, Mod-Alt-1 to 6, and Plain paragraph, Mod-Alt-0', () => {
  for (const level of [1, 2, 3, 4, 5, 6]) {
    it(`Mod-Alt-${level} makes a level ${level} heading`, () => {
      expect(after('ti|tle', `Mod-Alt-${level}`)).toBe(`${'#'.repeat(level)} ti|tle`)
    })
  }
  it('changes the level of a heading', () => {
    expect(after('## ti|tle', 'Mod-Alt-4')).toBe('#### ti|tle')
  })
  it('makes a list item a heading, without its bullet', () => {
    expect(after('  - it|em', 'Mod-Alt-2')).toBe('## it|em')
  })
  it('keeps the quote', () => {
    expect(after('> ti|tle', 'Mod-Alt-2')).toBe('> ## ti|tle')
  })
  it('makes each selected line a heading, and leaves blank lines alone', () => {
    expect(after('|one\n\ntwo|', 'Mod-Alt-3')).toBe('### |one\n\n### two|')
  })
  it('Mod-Alt-0 takes the heading off', () => {
    expect(after('### ti|tle', 'Mod-Alt-0')).toBe('ti|tle')
  })
  it('Mod-Alt-0 takes the bullet, number or checkbox off', () => {
    expect(after('- it|em', 'Mod-Alt-0')).toBe('it|em')
    expect(after('1. it|em', 'Mod-Alt-0')).toBe('it|em')
    expect(after('  - [ ] it|em', 'Mod-Alt-0')).toBe('it|em')
  })
})

describe('Quote, Mod-Shift-b', () => {
  it('quotes the line and takes the quote off again', () => {
    expect(after('a|b', 'Mod-Shift-b')).toBe('> a|b')
    expect(after('a|b', 'Mod-Shift-b', 2)).toBe('a|b')
  })
  it('quotes every selected line, a blank one between them without a trailing space', () => {
    expect(after('|one\n\ntwo|', 'Mod-Shift-b')).toBe('> |one\n>\n> two|')
  })
  it('takes off one level at a time', () => {
    expect(after('> > a|b', 'Mod-Shift-b')).toBe('> a|b')
  })
})

describe('Bulleted list, Mod-Alt-8', () => {
  it('makes bullets and takes them off again', () => {
    expect(after('a|b', 'Mod-Alt-8')).toBe('- a|b')
    expect(after('a|b', 'Mod-Alt-8', 2)).toBe('a|b')
  })
  it('makes every selected line a bullet, skipping blank ones', () => {
    expect(after('|one\ntwo\n\nthree|', 'Mod-Alt-8')).toBe('- |one\n- two\n\n- three|')
  })
  it('turns numbers and headings into bullets, and keeps a nested item nested', () => {
    expect(after('1. a|b', 'Mod-Alt-8')).toBe('- a|b')
    expect(after('## a|b', 'Mod-Alt-8')).toBe('- a|b')
    expect(after('- one\n  1. a|b', 'Mod-Alt-8')).toBe('- one\n  - a|b')
  })
  it('counts a checkbox as a bullet', () => {
    expect(after('- [ ] a|b', 'Mod-Alt-8')).toBe('a|b')
  })
})

describe('Numbered list, Mod-Alt-7', () => {
  it('numbers the lines and takes the numbers off again', () => {
    expect(after('|one\ntwo\nthree|', 'Mod-Alt-7')).toBe('1. |one\n2. two\n3. three|')
    expect(after('|one\ntwo|', 'Mod-Alt-7', 2)).toBe('|one\ntwo|')
  })
  it('turns bullets into numbers', () => {
    expect(after('- a|b', 'Mod-Alt-7')).toBe('1. a|b')
  })
})

describe('Code block, Mod-Alt-c', () => {
  it('fences the lines and takes the fence away again', () => {
    expect(after('a|b', 'Mod-Alt-c')).toBe('```\na|b\n```')
    expect(after('a|b', 'Mod-Alt-c', 2)).toBe('a|b')
  })
  it('fences several lines', () => {
    expect(after('|one\ntwo|', 'Mod-Alt-c')).toBe('```\n|one\ntwo|\n```')
  })
  it('opens an empty fence on an empty line, with the cursor inside', () => {
    expect(after('|', 'Mod-Alt-c')).toBe('```\n|\n```')
  })
})
