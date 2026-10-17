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
        .filter((name) =>
          /^live-(void|gap|gap-cursor|gap-item|gap-quote|pad-first|pad-last)$/.test(name)
        )
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
    // The cursor on the first blank line makes the second the free one; on the second, the first stays free.
    expect(spacing(doc, 2).map((row) => row.includes('void'))).toEqual([false, false, true, false])
    expect(spacing(doc, 3).map((row) => row.includes('void'))).toEqual([false, true, false, false])
  })

  it('lets the cursor stand on the gap itself, so the page does not move when it comes or goes', () => {
    // 'a', a blank line with the cursor, 'b': the blank line has the gap's height and 'b' gives its gap up.
    expect(spacing('a\n\nb', 2)).toEqual([[], ['gap-cursor'], []])
    expect(spacing('a\n\nb', 0)).toEqual([[], ['void'], ['gap']])
    // A longer run: the cursor's line is a whole line that carries the gap (as the text typed there would), the other blank
    // line is free, and the text gives up its gap.
    expect(spacing('a\n\n\nb', 2)).toEqual([[], ['gap'], ['void'], []])
    expect(spacing('a\n\n\nb', 3)).toEqual([[], ['void'], ['gap'], []])
    // Where the gap is not the block gap (a heading pads itself, items have a small one) the cursor's line is a full line.
    expect(spacing('## h\n\nb', 5)).toEqual([[], [], []])
    expect(spacing('- a\n\n- b', 4)[1]).toEqual([])
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

/** Heights in units of the page: a text line is 29, the block gap 16, the item gap 4, the stand-in for a gap 16. */
function height(doc: string, at: number): number {
  const rows = spacing(doc, at)
  const lines = doc.split('\n')
  return rows.reduce((total, row, i) => {
    if (row.includes('void')) return total
    if (row.includes('gap-cursor')) return total + 16
    const gap =
      row.includes('gap') || row.includes('gap-quote') ? 16 : row.includes('gap-item') ? 4 : 0
    return total + gap + (lines[i] === undefined ? 0 : 29)
  }, 0)
}
/** Where the caret sits on the page when it is on the line holding `at`: the top of that line plus its gap. */
function caretTop(doc: string, at: number): number {
  const rows = spacing(doc, at)
  const lineNumber = doc.slice(0, at).split('\n').length - 1
  let top = 0
  rows.forEach((row, i) => {
    if (i >= lineNumber) return
    if (row.includes('void')) return
    top += (row.includes('gap') ? 16 : 0) + 29
  })
  const here = rows[lineNumber]
  return top + (here.includes('gap-cursor') ? -3 : here.includes('gap') ? 16 : 0)
}

describe('the cursor on a blank line', () => {
  const docs = ['a\n\nb', 'a\n\n\nb', 'a\n\n\n\nb', 'a\nb\n\n\nc\nd', '> q\n\n\nb', 'a\n\n\n- x']

  it('leaves a run as tall as it is with the cursor away, on whichever blank line it is', () => {
    for (const doc of docs) {
      const away = height(doc, 0)
      let at = 0
      doc.split('\n').forEach((line) => {
        if (line === '')
          expect(height(doc, at), `${JSON.stringify(doc)} cursor at ${at}`).toBe(away)
        at += line.length + 1
      })
    }
  })

  it('does not move the caret when the first character is typed', () => {
    for (const doc of ['a\n\n\nb', 'a\n\n\n\nb', 'a\n\n\n- x', 'a\n\n', '## h\n\n\nb']) {
      let at = 0
      doc.split('\n').forEach((line, i) => {
        // Not the lone blank line (its caret sits in the gap and the paragraph opens beneath it) and not the end-of-file line.
        const alone = doc.split('\n')[i - 1] !== '' && doc.split('\n')[i + 1] !== ''
        if (line === '' && i > 0 && i < doc.split('\n').length - 1 && !alone) {
          const typed = doc.slice(0, at) + 'x' + doc.slice(at)
          expect(caretTop(typed, at + 1), `${JSON.stringify(doc)} line ${i}`).toBe(
            caretTop(doc, at)
          )
        }
        at += line.length + 1
      })
    }
  })

  it('gives a blank line at the end of a note, and one after a heading, the height of the paragraph typed there', () => {
    expect(spacing('a\n\n', 2)[1]).toEqual(['gap'])
    expect(spacing('## h\n\n\nb', 5)[1]).toEqual([])
  })
})
