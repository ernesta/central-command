// @vitest-environment jsdom
import { undo } from '@codemirror/commands'
import { describe, expect, it } from 'vitest'
import { openView, press, show } from './live-key-utils'

/** The cursor is written `¦` here: `|` is what a table is made of. */
const open = (marked: string): ReturnType<typeof openView> =>
  openView(marked, undefined, { cursor: '¦' })

/** Open `before`, press each chord in turn, and return the text with the cursor written in. */
function after(before: string, ...chords: string[]): string {
  const { view } = open(before)
  for (const chord of chords) expect(press(view, chord), `${chord} is handled`).toBe(true)
  return show(view, '¦')
}

const head = '| a | b |\n|---|---|\n'

describe('Tab in a table', () => {
  it('goes to the start of the next cell, along the row and down to the next', () => {
    const table = '| a | bb | c |\n|---|----|---|\n| 1 | 2 | 3 |\n'
    expect(after(table.replace('| a', '| ¦a'), 'Tab')).toBe(table.replace('| bb', '| ¦bb'))
    expect(after(table.replace('| a', '| ¦a'), 'Tab', 'Tab')).toBe(table.replace('| c', '| ¦c'))
    expect(after(table.replace('| a', '| ¦a'), 'Tab', 'Tab', 'Tab')).toBe(
      table.replace('| 1', '| ¦1')
    )
    expect(after(table.replace('| a', '| ¦a'), 'Tab', 'Tab', 'Tab', 'Tab')).toBe(
      table.replace('| 2', '| ¦2')
    )
  })

  it('skips the delimiter line, in both directions', () => {
    expect(after(`| a | ¦b |\n|---|---|\n| 1 | 2 |`, 'Tab')).toBe(
      `| a | b |\n|---|---|\n| ¦1 | 2 |`
    )
    expect(after(`${head}| ¦1 | 2 |`, 'Shift-Tab')).toBe(`| a | ¦b |\n|---|---|\n| 1 | 2 |`)
  })

  it('goes from the delimiter line to the cell below it, or the cell above it', () => {
    expect(after('| a | b |\n|-¦--|---|\n| 1 | 2 |', 'Tab')).toBe(
      '| a | b |\n|---|---|\n| ¦1 | 2 |'
    )
    expect(after('| a | b |\n|-¦--|---|\n| 1 | 2 |', 'Shift-Tab')).toBe(
      '| a | ¦b |\n|---|---|\n| 1 | 2 |'
    )
  })

  it('goes back with Shift-Tab, and stays in the very first cell', () => {
    expect(after(`${head}| 1 | ¦2 |`, 'Shift-Tab')).toBe(`${head}| ¦1 | 2 |`)
    expect(after('| ¦a | b |\n|---|---|\n| 1 | 2 |', 'Shift-Tab')).toBe(
      '| ¦a | b |\n|---|---|\n| 1 | 2 |'
    )
  })

  it('takes the cursor at the edge of a cell, on a pipe, or before the row', () => {
    expect(after('| a¦ | b |\n|---|---|\n| 1 | 2 |', 'Tab')).toBe(
      '| a | ¦b |\n|---|---|\n| 1 | 2 |'
    )
    // Just after a pipe is the cell after it.
    expect(after('| a |¦ b |\n|---|---|\n| 1 | 2 |', 'Tab')).toBe(
      '| a | b |\n|---|---|\n| ¦1 | 2 |'
    )
    expect(after('¦| a | b |\n|---|---|\n| 1 | 2 |', 'Tab')).toBe(
      '| a | ¦b |\n|---|---|\n| 1 | 2 |'
    )
  })

  it('puts the cursor inside an empty cell, after its space', () => {
    expect(after('| ¦a | b |\n|---|---|\n| | |\n', 'Tab', 'Tab')).toBe(
      '| a | b |\n|---|---|\n| ¦| |\n'
    )
    // No space at all between the pipes: the cursor goes between them.
    expect(after('| ¦a | b |\n|---|---|\n|| |\n', 'Tab', 'Tab')).toBe(
      '| a | b |\n|---|---|\n|¦| |\n'
    )
    expect(after('| ¦a | b |\n|---|---|\n|| |\n', 'Tab', 'Tab', 'Tab')).toBe(
      '| a | b |\n|---|---|\n|| ¦|\n'
    )
  })

  it('never changes the text when it moves', () => {
    const { view, reports } = open('| ¦a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |')
    for (let i = 0; i < 5; i++) press(view, 'Tab')
    for (let i = 0; i < 8; i++) press(view, 'Shift-Tab')
    expect(reports).toEqual([])
  })
})

describe('Tab in the last cell', () => {
  it('adds an empty row below with a cell for each column, and puts the cursor in its first cell', () => {
    expect(after(`${head}| 1 | ¦2 |`, 'Tab')).toBe(`${head}| 1 | 2 |\n| ¦ |  |`)
  })

  it('goes on into the new row with another Tab', () => {
    expect(after(`${head}| 1 | ¦2 |`, 'Tab', 'Tab')).toBe(`${head}| 1 | 2 |\n|  | ¦ |`)
  })

  it('adds the first row under a table that has only a header', () => {
    expect(after('| a | ¦b |\n|---|---|\n\ntext', 'Tab')).toBe(`${head}| ¦ |  |\n\ntext`)
  })

  it('writes a row like the last one: no outer pipes, or a quote in front', () => {
    expect(after('a | b\n-|-\n1 | ¦2', 'Tab')).toBe('a | b\n-|-\n1 | 2\n ¦ |  ')
    expect(after('> | a | b |\n> |---|---|\n> | 1 | ¦2 |', 'Tab')).toBe(
      '> | a | b |\n> |---|---|\n> | 1 | 2 |\n> | ¦ |  |'
    )
  })

  it('gives the new row a cell for each column of the header, whatever the last row has', () => {
    expect(after('| a | b | c |\n|---|---|---|\n| ¦1 |', 'Tab')).toBe(
      '| a | b | c |\n|---|---|---|\n| 1 |\n| ¦ |  |  |'
    )
  })

  it('adds only the row: one change, and one undo gives the note back', () => {
    const before = `${head}| 1 | 2 |`
    const { view, reports } = open(`${head}| 1 | ¦2 |`)
    press(view, 'Tab')
    expect(reports).toEqual([`${before}\n|  |  |`])
    undo(view)
    expect(view.state.sliceDoc()).toBe(before)
  })

  it("uses the note's own line break", () => {
    const { view, reports } = open('| a | b |\r\n|---|---|\r\n| 1 | ¦2 |')
    press(view, 'Tab')
    expect(reports[0]).toBe('| a | b |\r\n|---|---|\r\n| 1 | 2 |\r\n|  |  |')
    expect(view.state.selection.main.head).toBe(view.state.doc.line(4).from + 2)
  })
})

describe('Tab outside a table', () => {
  it('is left to the list keys, and to the page when there is no list', () => {
    const { view } = open('plain ¦text')
    expect(press(view, 'Tab')).toBe(false)
    expect(after('- a\n- ¦b', 'Tab')).toBe('- a\n  - ¦b')
  })

  it('is not ours with a selection over several lines', () => {
    const { view } = open('| a | b |\n|---|---|\n| ¦1 | 2 |\n| 3 | ¦4 |')
    expect(press(view, 'Tab')).toBe(false)
  })

  it('is not ours below the table (a line without pipes straight under it is a row of one cell, as in GitHub)', () => {
    const { view } = open(`${head}| 1 | 2 |\n\n¦after`)
    expect(press(view, 'Tab')).toBe(false)
  })
})
