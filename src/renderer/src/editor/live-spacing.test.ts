import { describe, expect, it } from 'vitest'
import { decorationsOf, stateFor } from './live-test-utils'

/** For each line of the note, the spacing classes it has (`void`, `gap`, `gap-item`, `gap-quote`, `pad-first`, `pad-last`). */
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
        .filter((name) => /^live-(void|gap|gap-item|gap-quote|pad-first|pad-last)$/.test(name))
        .map((name) => name.replace('live-', ''))
    })
}
const textLines = (rows: string[][], doc: string): string[][] =>
  rows.filter((_, i) => doc.split('\n')[i].trim() !== '')

describe('the space between blocks', () => {
  it('is the same with no blank line or one between two paragraphs', () => {
    const results = ['a\nb', 'a\n\nb'].map((doc) => textLines(spacing(doc), doc))
    expect(results[0]).toEqual([[], ['gap']])
    expect(results[1]).toEqual(results[0])
  })

  it('draws the first blank line of a run with no height and keeps every one after it', () => {
    const void_ = (doc: string, at?: number): boolean[] =>
      spacing(doc, at).map((row) => row.includes('void'))
    expect(void_('a\n\nb')).toEqual([false, true, false])
    expect(void_('a\n\n\nb')).toEqual([false, true, false, false])
    expect(void_('a\n\n\n\n\nb')).toEqual([false, true, false, false, false, false])
  })

  it('keeps the line with the cursor, and the first blank line again once it is not the first', () => {
    const doc = 'a\n\n\nb'
    expect(spacing(doc, 2).map((row) => row.includes('void'))).toEqual([false, false, false, false])
    expect(spacing(doc, 3).map((row) => row.includes('void'))).toEqual([false, true, false, false])
  })

  it('counts a run at the start of a note and after a heading the same way', () => {
    expect(spacing('\n\na', 3).map((r) => r.includes('void'))).toEqual([true, false, false])
    expect(spacing('## h\n\n\nb', 8).map((r) => r.includes('void'))).toEqual([
      false,
      true,
      false,
      false
    ])
  })

  it('never counts the empty last line of a note as part of a run', () => {
    // 'a', one blank line, then the final line break: one blank line and the end of the file.
    expect(spacing('a\n\n', 0).map((r) => r.includes('void'))).toEqual([false, true, true])
    // Two blank lines: the second shows, the end of the file does not.
    expect(spacing('a\n\n\n', 0).map((r) => r.includes('void'))).toEqual([false, true, false, true])
  })

  it('does not count blank lines inside code', () => {
    const doc = 'a\n```\nx\n\n\ny\n```\nb'
    expect(spacing(doc, 0).map((r) => r.includes('void'))).toEqual(new Array(8).fill(false))
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
    expect(rows[7]).toEqual(['gap-quote', 'pad-last'])
  })

  it('has no gap between the rows of a table, and one on each side', () => {
    const doc = 'a\n\n| h | i |\n|---|---|\n| 1 | 2 |\n\nb'
    expect(textLines(spacing(doc), doc)).toEqual([[], ['gap'], [], [], ['gap']])
  })
})
