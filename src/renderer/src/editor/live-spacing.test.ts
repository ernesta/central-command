import { describe, expect, it } from 'vitest'
import { decorationsOf, stateFor } from './live-test-utils'

/** For each line of the note, the spacing classes it has (`gap`, `gap-item`, `gap-quote`, `pad-first`, `pad-last`, `sep`). */
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
        .filter((name) => /^live-(gap|gap-item|gap-quote|pad-first|pad-last|sep)$/.test(name))
        .map((name) => name.replace('live-', ''))
    })
}

/** Heights in px: a line 29, the block gap 16, the item gap 4 (a quote's gap is padding too). */
function height(row: string[]): number {
  if (row.includes('sep')) return 16
  return (
    29 + (row.includes('gap') || row.includes('gap-quote') ? 16 : row.includes('gap-item') ? 4 : 0)
  )
}

describe('the space between lines', () => {
  it('gives every line of text, and every blank line, the block gap above it', () => {
    expect(spacing('a\nb\nc')).toEqual([[], ['gap'], ['gap']])
    expect(spacing('a\n\nb')).toEqual([[], ['gap'], ['gap']])
    expect(spacing('a\n\n\nb')).toEqual([[], ['gap'], ['gap'], ['gap']])
  })

  it('makes a run of n blank lines n lines of space', () => {
    const total = (blanks: number): number =>
      spacing(`a${'\n'.repeat(blanks + 1)}b`).reduce((sum, row) => sum + height(row), 0)
    expect(total(1) - total(0)).toBe(45)
    expect(total(2) - total(1)).toBe(45)
    expect(total(3) - total(2)).toBe(45)
  })

  it('does not change with the cursor, wherever it is', () => {
    for (const doc of ['a\n\nb', 'a\n\n\nb', '- a\n\n- b', '> q\n\nb', '## h\n\nb']) {
      const away = spacing(doc, 0)
      let at = 0
      doc.split('\n').forEach((line) => {
        expect(spacing(doc, at), JSON.stringify(doc)).toEqual(away)
        at += line.length + 1
      })
    }
  })

  it('gives a blank line the gap the text typed there would have, so typing moves nothing', () => {
    for (const doc of [
      'a\n|',
      'a\n|\nb',
      'a\n\n|\nb',
      '- a\n|',
      '> q\n|',
      '## h\n|',
      '## h\n\n|',
      'a\n```\nx\n```\n|'
    ]) {
      const at = doc.indexOf('|')
      const plain = doc.replace('|', '')
      const typed = plain.slice(0, at) + 'x' + plain.slice(at)
      const line = plain.slice(0, at).split('\n').length - 1
      expect(spacing(plain, at)[line], JSON.stringify(doc)).toEqual(
        spacing(typed, at + 1)[line].filter((name) => name.startsWith('gap'))
      )
    }
  })

  it("draws the note's empty last line with no gap of its own until the cursor is on it", () => {
    expect(spacing('a\n', 0)).toEqual([[], []])
    expect(spacing('a\n', 2)).toEqual([[], ['gap']])
  })

  it('has no gap on the first line of a note, even a blank one', () => {
    expect(spacing('\na', 2)).toEqual([[], []])
    expect(spacing('a')).toEqual([[]])
  })

  it('does not draw blank lines inside code as lines of their own', () => {
    const doc = 'a\n```\nx\n\n\ny\n```\nb'
    expect(spacing(doc, 0).map((row) => row.includes('gap'))).toEqual([
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      true
    ])
  })

  it('gives a list after text, and text after a list, the block gap, and items a small one', () => {
    expect(spacing('text\n- a\n- b\n\nafter')).toEqual([[], ['gap'], ['gap-item'], ['sep'], []])
  })

  it('leaves a heading to pad itself', () => {
    expect(spacing('text\n## Head\nmore')).toEqual([[], [], []])
  })

  it('pads the first and last line of code and quotes', () => {
    const rows = spacing('a\n```\nx\n\ny\n```\n> q\n> r')
    expect(rows[3]).toEqual([])
    expect(rows[1]).toEqual(['gap', 'pad-first'])
    expect(rows[5]).toEqual(['pad-last'])
    expect(rows[6]).toEqual(['gap', 'pad-first'])
    expect(rows[7]).toEqual(['gap-quote', 'pad-last'])
  })

  it('has no gap between the rows of a table, and one on each side', () => {
    const doc = 'a\n| h | i |\n|---|---|\n| 1 | 2 |\n\nb'
    expect(spacing(doc)).toEqual([[], ['gap'], [], [], ['sep'], []])
  })

  describe('a blank line Markdown needs between two blocks', () => {
    const total = (doc: string, at = 0): number =>
      spacing(doc, at).reduce((sum, row) => sum + height(row), 0)

    it('is the gap itself: the blocks are as far apart as two paragraphs', () => {
      const apart = total('p\nq')
      for (const doc of [
        '- a\n\nq',
        '1. a\n\nq',
        '> a\n\nq',
        '| h |\n|---|\n| 1 |\n\nq',
        '| h |\n|---|\n| 1 |\n\n---',
        'p\n\n---'
      ]) {
        const rows = spacing(doc)
        expect(rows.flat().includes('sep'), doc).toBe(true)
        const last = rows[rows.length - 1]
        expect(
          last.includes('gap') || last.includes('gap-item') || last.includes('gap-quote'),
          doc
        ).toBe(false)
      }
      // List item to paragraph: 29 for the item, 16 for the gap, 29 for the line.
      expect(total('- a\n\nq')).toBe(apart)
      expect(total('> a\n\nq')).toBe(apart)
      expect(total('p\n\n---')).toBe(apart)
    })

    it('does not change with the cursor, on the blank line or off it', () => {
      for (const doc of ['- a\n\nq', '> a\n\nq', '| h |\n|---|\n| 1 |\n\nq', 'p\n\n---']) {
        const away = spacing(doc, 0)
        let at = 0
        doc.split('\n').forEach((line) => {
          expect(spacing(doc, at), JSON.stringify(doc)).toEqual(away)
          at += line.length + 1
        })
      }
    })

    it('is only for a lone blank line where the line below would join the block above', () => {
      for (const doc of [
        '- a\n\n\nq', // two blank lines are space on purpose
        '- a\n\n- b',
        '- a\n\n## h',
        '- a\n\n> q',
        '> a\n\n- b',
        'p\n\nq',
        '## h\n\nq',
        '```\nx\n```\n\nq',
        '- a\n\n```\nx\n```'
      ])
        expect(spacing(doc).flat().includes('sep'), JSON.stringify(doc)).toBe(false)
    })
  })
})
