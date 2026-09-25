import { describe, expect, it } from 'vitest'
import { nameMatchesTitle, noteBaseName, noteStem } from './file-name'

describe('noteBaseName', () => {
  it('follows the title, without colons', () => {
    expect(noteBaseName('Methods: participants', [])).toBe('Methods participants')
    expect(noteStem('12:30 call')).toBe('12-30 call')
    expect(noteStem('a/b?')).toBe('a_b_')
  })

  it('numbers a name that is taken, ignoring case', () => {
    expect(noteBaseName('Ideas', ['ideas'])).toBe('Ideas 2')
    expect(noteBaseName('Ideas', ['Ideas', 'Ideas 2'])).toBe('Ideas 3')
  })

  it('calls a note without a title Untitled, then Untitled 2', () => {
    expect(noteBaseName('', [])).toBe('Untitled')
    expect(noteBaseName('  ', ['Untitled'])).toBe('Untitled 2')
  })
})

describe('nameMatchesTitle', () => {
  it('accepts the stem and the stem with a number', () => {
    expect(nameMatchesTitle('Ideas', 'Ideas')).toBe(true)
    expect(nameMatchesTitle('ideas 3', 'Ideas')).toBe(true)
    expect(nameMatchesTitle('Ideas notes', 'Ideas')).toBe(false)
    expect(nameMatchesTitle('Untitled 2', '')).toBe(true)
  })
})
