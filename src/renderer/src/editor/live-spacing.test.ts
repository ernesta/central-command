import { describe, expect, it } from 'vitest'
import { decorationsOf, stateFor } from './live-test-utils'

/** For each line of the note, the spacing classes it has (`void`, `gap`, `item`, `first`, `last`). */
function spacing(doc: string, at = doc.length): string[][] {
  const state = stateFor(doc, at)
  const found = decorationsOf(state)
  return state.doc
    .toString()
    .split('\n')
    .map((_, i) => {
      const from = state.doc.line(i + 1).from
      return found
        .filter((seen) => seen.from === from)
        .flatMap((seen) => seen.kind.split(' '))
        .filter((name) => /^live-(void|gap|gap-item|pad-first|pad-last)$/.test(name))
        .map((name) => name.replace('live-', ''))
    })
}
const textLines = (rows: string[][], doc: string): string[][] =>
  rows.filter((_, i) => doc.split('\n')[i].trim() !== '')

describe('the space between blocks', () => {
  it('is the same with no blank line, one or five between two paragraphs', () => {
    const results = ['a\nb', 'a\n\nb', 'a\n\n\n\n\n\nb'].map((doc) => textLines(spacing(doc), doc))
    expect(results[0]).toEqual([[], ['gap']])
    expect(results[1]).toEqual(results[0])
    expect(results[2]).toEqual(results[0])
  })

  it('draws blank lines with no height, unless the cursor is on one', () => {
    const doc = 'a\n\n\nb'
    expect(spacing(doc, doc.length).map((row) => row.includes('void'))).toEqual([
      false,
      true,
      true,
      false
    ])
    expect(spacing(doc, 2).map((row) => row.includes('void'))).toEqual([false, false, true, false])
  })

  it('gives a list after text, and text after a list, the block gap, and items a small one', () => {
    const doc = 'text\n- a\n- b\n\n\nafter'
    expect(textLines(spacing(doc), doc)).toEqual([[], ['gap'], ['gap-item'], ['gap']])
  })

  it('leaves a heading to pad itself', () => {
    const doc = 'text\n## Head\nmore'
    expect(textLines(spacing(doc), doc)).toEqual([[], [], []])
  })

  it('keeps blank lines inside fenced code, and pads the first and last line of code and quotes', () => {
    const doc = 'a\n```\nx\n\ny\n```\n> q\n> r'
    const rows = spacing(doc)
    expect(rows[3]).toEqual([])
    expect(rows[1]).toEqual(['gap', 'pad-first'])
    expect(rows[5]).toEqual(['pad-last'])
    expect(rows[6]).toEqual(['gap', 'pad-first'])
    expect(rows[7]).toEqual(['pad-last'])
  })

  it('has no gap between the rows of a table, and one on each side', () => {
    const doc = 'a\n\n| h | i |\n|---|---|\n| 1 | 2 |\n\nb'
    expect(textLines(spacing(doc), doc)).toEqual([[], ['gap'], [], [], ['gap']])
  })
})
