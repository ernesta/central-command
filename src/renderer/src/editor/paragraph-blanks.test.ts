import { describe, expect, it } from 'vitest'
import {
  dropLines,
  firstReadingDifference,
  pairLabel,
  planParagraphBlanks,
  singleBlanks
} from './paragraph-blanks'

const tidy = (body: string): string =>
  dropLines(
    body,
    planParagraphBlanks(body).remove.map((b) => b.line)
  )
const content = (t: string): string[] => t.split('\n').filter((l) => l.trim() !== '')

describe('singleBlanks', () => {
  it('names what is above and below each lone blank line', () => {
    const body = '# H\n\nOne\n\n- a\n\nTwo\n\n| a |\n| - |\n| b |\n\n> q\n\n---\n'
    expect(singleBlanks(body).map((b) => pairLabel(b.above, b.below))).toEqual([
      'heading + paragraph',
      'list + paragraph',
      'list + paragraph',
      'paragraph + table',
      'quote + table',
      'quote + rule'
    ])
  })

  it('skips runs of blank lines, the ends of the note and blank lines inside code', () => {
    expect(singleBlanks('A\n\n\nB\n').length).toBe(0)
    expect(singleBlanks('A\n\n').length).toBe(0)
    expect(singleBlanks('```\na\n\nb\n```\n').length).toBe(0)
    expect(singleBlanks('~~~\na\n\nb\n').length).toBe(0)
  })

  it('treats a whitespace-only line as blank and finds it under CRLF', () => {
    expect(singleBlanks('A\r\n  \r\nB\r\n').map((b) => b.line)).toEqual([1])
  })
})

describe('planParagraphBlanks', () => {
  it('removes a blank line between two paragraph lines', () => {
    expect(tidy('One\n\nTwo\n\nThree\n')).toBe('One\nTwo\nThree\n')
  })

  it('leaves a run of blank lines alone (they are space on purpose)', () => {
    expect(tidy('One\n\n\nTwo\n')).toBe('One\n\n\nTwo\n')
  })

  it('removes the blank line next to a heading, list, table, quote or rule when the reading stays the same', () => {
    expect(tidy('## H\n\ntext\n\n- a\n\n- b\n')).toBe('## H\ntext\n- a\n- b\n')
    expect(tidy('text\n\n| a |\n| - |\n| b |\n')).toBe('text\n| a |\n| - |\n| b |\n')
    expect(tidy('text\n\n> q\n')).toBe('text\n> q\n')
    expect(tidy('---\n\ntext\n')).toBe('---\ntext\n')
  })

  it('keeps the blank line that stops a line joining the block above it', () => {
    for (const body of [
      '- a\n\ntext\n',
      '1. a\n\ntext\n',
      '> q\n\ntext\n',
      '| a |\n| - |\n| b |\n\ntext\n',
      'text\n\n---\n'
    ]) {
      expect(planParagraphBlanks(body).keep.length, body).toBe(1)
      expect(tidy(body), body).toBe(body)
    }
  })

  it('does not join a paragraph to a list item above it', () => {
    expect(tidy('- item\n\nA paragraph\n')).toBe('- item\n\nA paragraph\n')
    expect(tidy('1. item\n\nA paragraph\n')).toBe('1. item\n\nA paragraph\n')
  })

  it('keeps a blank line when the lines joined would read differently', () => {
    // A hard break at the end of the line.
    expect(planParagraphBlanks('One  \n\nTwo\n').keep.length).toBe(1)
    expect(planParagraphBlanks('One\\\n\nTwo\n').keep.length).toBe(1)
    // A setext heading underline.
    expect(planParagraphBlanks('Title\n\n===\n').keep.length).toBe(1)
    // An HTML block that ends at a blank line.
    expect(planParagraphBlanks('<div>\n\nTwo\n').keep.length).toBe(1)
    // Emphasis that would run across the lines.
    expect(planParagraphBlanks('*One\n\nTwo*\n').keep.length).toBe(1)
    expect(tidy('One  \n\nTwo\n')).toBe('One  \n\nTwo\n')
  })

  it('keeps a blank line that is fine alone but not together with the others', () => {
    const body = '*One\n\nTwo\n\nThree*\n'
    const plan = planParagraphBlanks(body)
    expect(plan.remove.map((b) => b.line)).toEqual([1])
    expect(plan.keep.map((b) => b.line)).toEqual([3])
    expect(firstReadingDifference(body, dropLines(body, [1, 3]))).not.toBeNull()
    expect(tidy(body)).toBe('*One\nTwo\n\nThree*\n')
  })

  it('keeps CRLF line breaks and removes the right lines', () => {
    expect(tidy('One\r\n\r\nTwo\r\n\r\n- a\r\n\r\nB\r\n')).toBe('One\r\nTwo\r\n- a\r\n\r\nB\r\n')
  })

  it('does not touch blank lines in a fence, and finds nothing the second time', () => {
    const body = 'One\n\nTwo\n\n```\na\n\nb\n```\n\nThree\n\nFour\n'
    const once = tidy(body)
    expect(once).toBe('One\nTwo\n\n```\na\n\nb\n```\n\nThree\nFour\n')
    expect(planParagraphBlanks(once).remove).toEqual([])
  })

  it('reads the same afterwards: nothing but blank lines is removed (generated notes)', () => {
    const pieces = ['One', 'Two *x*', '', '', '- a', '# H', '| a |', '> q', '```', 'x  ', '**b** c']
    let seed = 11
    const next = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff)
    for (let n = 0; n < 150; n++) {
      const body = Array.from({ length: 10 }, () => pieces[next() % pieces.length]).join('\n')
      const out = tidy(body)
      expect(content(out)).toEqual(content(body))
      if (out !== body) expect(firstReadingDifference(body, out)).toBeNull()
    }
  })
})

describe('firstReadingDifference', () => {
  it('is null for the same text and names the first differing line otherwise', () => {
    expect(firstReadingDifference('A\n\nB\n', 'A\n\nB\n')).toBeNull()
    expect(firstReadingDifference('A\n\nB\n', 'A\nB\n')).toBeNull()
    expect(firstReadingDifference('A  \n\nB\n', 'A  \nB\n')).toBe(1)
  })
})
