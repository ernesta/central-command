import { describe, expect, it } from 'vitest'
import { wordCount, wordCountLabel } from './words'

describe('wordCount', () => {
  it('counts words, not Markdown marks', () => {
    expect(
      wordCount('## Participants\n\nSchools were **recruited** through [Luminos](https://x.org).\n')
    ).toBe(6)
    expect(wordCount('- [x] one\n- [ ] two\n')).toBe(2)
  })

  it('is zero for an empty or mark-only note', () => {
    expect(wordCount('')).toBe(0)
    expect(wordCount('\n\n---\n')).toBe(0)
  })

  it('counts a bare link once, whether or not the editor wrapped it in angle brackets', () => {
    expect(wordCount('See https://x.org/a?b=1 now')).toBe(3)
    expect(wordCount('See <https://x.org/a?b=1> now')).toBe(3)
    expect(wordCount('- <https://x.org/a>')).toBe(1)
  })

  it('still drops other inline HTML', () => {
    expect(wordCount('one <br> two')).toBe(2)
  })

  it('counts a long note in full, not just its start', () => {
    expect(wordCount('word '.repeat(2000))).toBe(2000)
  })
})

// The live editor's text is the file's own Markdown, exactly as typed, where the old editor wrote its own normal form.
describe('wordCount of Markdown as it is typed', () => {
  it('drops nested quote marks, and quote marks in front of a heading or a list', () => {
    expect(wordCount('> > a b')).toBe(2)
    expect(wordCount('>> a b')).toBe(2)
    expect(wordCount('> ## a b')).toBe(2)
    expect(wordCount('> - a b')).toBe(2)
  })
  it('drops a heading’s closing hashes, an empty heading, and a setext underline', () => {
    expect(wordCount('## Title ##')).toBe(1)
    expect(wordCount('#')).toBe(0)
    expect(wordCount('###\ntext')).toBe(1)
    expect(wordCount('Title\n=====')).toBe(1)
  })
  it('keeps a hash that is part of a word or a line', () => {
    expect(wordCount('issue #12 and C#')).toBe(4)
  })
  it('does not count a backslash escape or a line-ending backslash as a word', () => {
    expect(wordCount('a \\* b')).toBe(2)
    expect(wordCount('end \\\nnext')).toBe(2)
    expect(wordCount('one\\\ntwo')).toBe(2)
  })
  it('counts a mention or link by its label, even one with escaped brackets, and never its address', () => {
    expect(wordCount('[Kathy Rastle](cc://person/Kathy%20Rastle) said')).toBe(3)
    expect(wordCount('see [a \\[b\\]](cc://note/x) now')).toBe(4)
    expect(wordCount('[t](https://example.org/a_b_c "a title")')).toBe(1)
  })
  it('counts every kind of bullet, number and checkbox as no word', () => {
    expect(wordCount('* one\n  * two\n+ three\n1) four\n- [X] five')).toBe(5)
  })
  it('counts the same with Windows line breaks', () => {
    expect(wordCount('## A ##\r\n> > b c\r\n- d')).toBe(4)
  })
})

describe('wordCountLabel', () => {
  it('says word or words', () => {
    expect(wordCountLabel(1)).toBe('1 word')
    expect(wordCountLabel(412)).toBe('412 words')
    expect(wordCountLabel(1234)).toBe('1,234 words')
  })
})
