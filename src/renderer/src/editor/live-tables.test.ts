import { describe, expect, it } from 'vitest'
import { alignmentsOf, splitRow } from './live-tables'
import { decorationsOf, hiddenText, stateFor } from './live-test-utils'

const cellsOf = (line: string): string[] =>
  splitRow(line).cells.map((cell) => line.slice(cell.from, cell.to))

describe('splitRow', () => {
  it('takes the cells between the pipes, without the white space round them', () => {
    expect(cellsOf('| a | bb |')).toEqual(['a', 'bb'])
    expect(cellsOf('|a|b|c|')).toEqual(['a', 'b', 'c'])
    expect(cellsOf('|   padded   |x|')).toEqual(['padded', 'x'])
  })

  it('reads a row without outer pipes', () => {
    expect(cellsOf('a | b')).toEqual(['a', 'b'])
    expect(cellsOf('| a | b')).toEqual(['a', 'b'])
    expect(cellsOf('a | b |')).toEqual(['a', 'b'])
    const row = splitRow('a | b')
    expect([row.leading, row.trailing]).toEqual([false, false])
  })

  it('does not split at an escaped pipe, but does after an escaped backslash', () => {
    expect(cellsOf('| a \\| b | c |')).toEqual(['a \\| b', 'c'])
    expect(cellsOf('| a \\\\| b |')).toEqual(['a \\\\', 'b'])
  })

  it('keeps empty cells, with or without a space in them', () => {
    expect(cellsOf('| | x ||')).toEqual(['', 'x', ''])
    const [empty, , bare] = splitRow('| | x ||').cells
    expect(empty.gapTo - empty.gapFrom).toBe(1)
    expect(bare.gapTo - bare.gapFrom).toBe(0)
  })

  it('skips the quote markers and the indentation in front of the row', () => {
    const row = splitRow('> > | a | b |')
    expect(row.start).toBe(4)
    expect(cellsOf('> > | a | b |')).toEqual(['a', 'b'])
  })

  it('has no cells in a line without a pipe or text', () => {
    expect(splitRow('').cells).toEqual([])
    expect(splitRow('   ').cells).toEqual([])
  })
})

describe('alignmentsOf', () => {
  it('reads the colons of the delimiter row', () => {
    expect(alignmentsOf('|:--|:-:|--:|---|')).toEqual(['left', 'center', 'right', 'left'])
    expect(alignmentsOf('| :--- | :---: | ---: |')).toEqual(['left', 'center', 'right'])
  })
})

const table = '| a | bb |\n|---|---|\n| 1 | **two** |\n'
const doc = `Intro\n\n${table}\nAfter\n`
const inside = (needle: string, offset = 0): number => doc.indexOf(needle) + offset

describe('a table away from the cursor', () => {
  const state = stateFor(doc, 0)

  it('hides the pipes and the white space round each cell, and the whole delimiter line', () => {
    expect(hiddenText(state)).toEqual([
      '| ',
      ' | ',
      ' |',
      '|---|---|',
      '| ',
      ' | ',
      '**',
      '**',
      ' |'
    ])
  })

  it('draws each line as a row, the first as the header, with one set of column widths', () => {
    const kinds = decorationsOf(state).map((seen) => seen.kind)
    expect(kinds.filter((kind) => kind === 'live-table-row live-table-head')).toHaveLength(1)
    expect(kinds.filter((kind) => kind === 'live-table-row')).toHaveLength(1)
    expect(kinds.filter((kind) => kind === 'live-table-rule')).toHaveLength(1)
    expect(kinds.filter((kind) => kind.startsWith('live-cell'))).toHaveLength(4)
    expect(kinds).not.toContain('live-table')
  })

  it('is drawn the same while the editor is not focused (nothing is revealed then)', () => {
    expect(hiddenText(stateFor(doc, inside('1 |')), false)).toEqual(hiddenText(state))
  })

  it('does not change the text', () => {
    expect(state.sliceDoc()).toBe(doc)
  })
})

describe('a table with the cursor in it', () => {
  it('is the text: no pipe hidden, the pipes and the dashes in the marker colour, monospace lines', () => {
    for (const at of [
      inside('| a'),
      inside('a |'),
      inside('|---|', 2),
      inside('two'),
      inside('two', 3)
    ]) {
      const state = stateFor(doc, at)
      // Only the bold marks of the cell the cursor is not in are hidden, as anywhere else.
      const touching = at >= inside('**two**') && at <= inside('**two**', 7)
      expect(hiddenText(state), `@${at}`).toEqual(touching ? [] : ['**', '**'])
      const seen = decorationsOf(state)
      expect(seen.filter((s) => s.kind === 'live-table')).toHaveLength(3)
      const pipes = seen
        .filter((s) => s.kind === 'live-tablemark')
        .map((s) => state.doc.sliceString(s.from, s.to))
      expect(pipes, `@${at}`).toEqual(['|', '|', '|', '|---|---|', '|', '|', '|'])
    }
  })

  it('is the text for the whole table even when the cursor is on the delimiter line or at the end of a row', () => {
    expect(hiddenText(stateFor(doc, inside('|---|---|', 9)))).not.toContain('|---|---|')
    expect(hiddenText(stateFor(doc, inside('**two**|\n') + 9))).not.toContain('| ')
  })

  it('is the grid again when the cursor is on the blank line before or after', () => {
    expect(hiddenText(stateFor(doc, inside('\n\n|') + 1))).toContain('|---|---|')
    expect(hiddenText(stateFor(doc, inside('\nAfter')))).toContain('|---|---|')
  })
})

describe('the parts of a table', () => {
  it('keeps an empty cell in the grid: a space is shown, no space at all is a placeholder', () => {
    const empties = '| a | b | c |\n|---|---|---|\n| | x ||\n'
    const state = stateFor(`${empties}\nend`, empties.length + 2)
    const seen = decorationsOf(state)
    // header 3 cells + body: the space cell (1 character), "x", and the bare one (a widget)
    expect(seen.filter((s) => s.kind.startsWith('live-cell'))).toHaveLength(5)
    expect(seen.filter((s) => s.kind === 'widget')).toHaveLength(1)
    const bodyStart = empties.indexOf('| |')
    expect(
      seen
        .filter((s) => s.kind.startsWith('live-cell') && s.from >= bodyStart)
        .map((s) => state.doc.sliceString(s.from, s.to))
    ).toEqual([' ', 'x'])
  })

  it('shows an escaped pipe inside its cell', () => {
    const escaped = '| a | b |\n|---|---|\n| x \\| y | z |\n\nend'
    const state = stateFor(escaped, escaped.length)
    expect(hiddenText(state)).not.toContain('|')
    const cells = decorationsOf(state)
      .filter((s) => s.kind.startsWith('live-cell'))
      .map((s) => state.doc.sliceString(s.from, s.to))
    expect(cells).toEqual(['a', 'b', 'x \\| y', 'z'])
  })

  it('aligns cells as the delimiter line asks', () => {
    const aligned = '| a | b | c |\n|:--|:-:|--:|\n| 1 | 2 | 3 |\n\nend'
    const kinds = decorationsOf(stateFor(aligned, aligned.length)).map((s) => s.kind)
    expect(kinds.filter((k) => k === 'live-cell live-cell-center')).toHaveLength(2)
    expect(kinds.filter((k) => k === 'live-cell live-cell-right')).toHaveLength(2)
  })

  it('gives a ragged row the widths of the widest, and draws the cells it has', () => {
    const ragged = '| a | b |\n|---|---|\n| 1 |\n| 1 | 2 | 3 |\n\nend'
    const seen = decorationsOf(stateFor(ragged, ragged.length))
    expect(seen.filter((s) => s.kind.startsWith('live-cell'))).toHaveLength(2 + 1 + 3)
  })

  it('keeps the text of a table inside a quote or a list', () => {
    for (const nested of [
      '> | a | b |\n> |---|---|\n> | 1 | 2 |\n\nend',
      '- item\n\n  | a | b |\n  |---|---|\n  | 1 | 2 |\n\nend'
    ]) {
      const state = stateFor(nested, nested.length)
      expect(hiddenText(state).filter((text) => text.includes('|'))).toEqual([])
      expect(decorationsOf(state).some((s) => s.kind === 'live-table-row')).toBe(false)
      expect(decorationsOf(state).some((s) => s.kind === 'live-table')).toBe(true)
    }
  })

  it('draws the inline marks of a cell, and shows them while the cursor touches them', () => {
    expect(hiddenText(stateFor(doc, 0))).toContain('**')
  })
})

describe('hidden text in tables', () => {
  const samples = [
    doc,
    '| a |\n|---|\n| |\n\nx',
    '| a | b |\n|:-:|--:|\n||x|\n| \\| | `c|d` |\n| 1 |\n| 1 | 2 | 3 |\n',
    'a | b\n-|-\n1 | 2\n',
    '   | a | b |\n   |---|---|\n   | 1 | 2 |\n',
    '| a | b |\r\n|---|---|\r\n| 1 | 2 |\r\n\r\nend',
    '| a | b |\n|---|---|'
  ]

  it('never has the cursor inside it, and never crosses a line', () => {
    for (const sample of samples)
      for (let pos = 0; pos <= stateFor(sample).doc.length; pos++) {
        const state = stateFor(sample, pos)
        for (const seen of decorationsOf(state)) {
          if (seen.kind !== 'hidden') continue
          expect(seen.from < pos && pos < seen.to, `${JSON.stringify(sample)} @${pos}`).toBe(false)
          expect(state.doc.lineAt(seen.from).number).toBe(state.doc.lineAt(seen.to).number)
        }
      }
  })

  it('leaves the text as it is, however it is drawn', () => {
    for (const sample of samples) expect(stateFor(sample, 3).sliceDoc()).toBe(sample)
  })

  it('hides, with the cursor outside, every character of a row but its cells', () => {
    for (const sample of samples) {
      const closed = `${sample}\n\nend`
      const state = stateFor(closed, stateFor(closed).doc.length)
      const hidden = new Set<number>()
      for (const seen of decorationsOf(state))
        if (seen.kind === 'hidden') for (let i = seen.from; i < seen.to; i++) hidden.add(i)
      // Every line that is a table row keeps only text that is not a pipe, a dash row, or white space round a cell.
      for (let n = 1; n <= state.doc.lines; n++) {
        const line = state.doc.line(n)
        const row = splitRow(line.text)
        if (!row.cells.length) continue
        for (const pipe of row.pipes)
          expect(hidden.has(line.from + pipe), `${JSON.stringify(sample)} line ${n}`).toBe(true)
      }
    }
  })
})
