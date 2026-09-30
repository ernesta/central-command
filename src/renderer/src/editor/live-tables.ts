import { EditorSelection, type EditorState, type StateCommand } from '@codemirror/state'
import { Decoration, WidgetType } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { enclosing, withBreaks } from './live-lines'
import type { Extent } from './live-reveal'

/*
 * Tables. The document stays the Markdown text. While the cursor is in a table, its lines are the text in a monospace
 * face with the pipes in the marker colour; everywhere else each line is drawn as a row of a grid: the pipes and the
 * white space round every cell are hidden (a hidden range never crosses a line) and the delimiter line (`|---|---|`)
 * collapses into a rule under the header. Nothing here edits text except the one row Tab adds at the end of a table.
 */

/** One cell of a row, as offsets into the line's text. */
export interface Cell {
  /** Everything between the two pipes that enclose the cell. */
  gapFrom: number
  gapTo: number
  /** The cell's text without the white space round it; empty (`from === to`, at `gapFrom`) for an empty cell. */
  from: number
  to: number
}

/** A table line taken apart. Offsets are into the line's text. */
export interface RowParts {
  /** Where the row starts: after the indentation or quote markers. */
  start: number
  /** Where it ends: after the last character that is not white space. */
  end: number
  /** Every pipe that separates cells (`\|` is text, not a pipe). */
  pipes: number[]
  leading: boolean
  trailing: boolean
  cells: Cell[]
}

const PREFIX = /^(?:[ \t]*>[ ]?)*[ \t]*/

/** Is the pipe at `at` escaped: preceded by an odd number of backslashes. */
function escaped(text: string, at: number): boolean {
  let slashes = 0
  for (let i = at - 1; i >= 0 && text[i] === '\\'; i--) slashes += 1
  return slashes % 2 === 1
}

export function splitRow(text: string): RowParts {
  const start = PREFIX.exec(text)?.[0].length ?? 0
  const end = text.trimEnd().length
  const pipes: number[] = []
  for (let i = start; i < end; i++) if (text[i] === '|' && !escaped(text, i)) pipes.push(i)
  const leading = pipes[0] === start
  const trailing = pipes.length > 0 && pipes[pipes.length - 1] === end - 1 && end - 1 >= start
  const cells: Cell[] = []
  const add = (gapFrom: number, gapTo: number): void => {
    let from = gapFrom
    let to = gapTo
    while (from < to && /\s/.test(text[from])) from += 1
    while (to > from && /\s/.test(text[to - 1])) to -= 1
    if (from === to) from = to = gapFrom
    cells.push({ gapFrom, gapTo, from, to })
  }
  let segmentStart = leading ? pipes[0] + 1 : start
  for (let i = leading ? 1 : 0; i < pipes.length; i++) {
    add(segmentStart, pipes[i])
    segmentStart = pipes[i] + 1
  }
  if (!trailing && segmentStart <= end && end > start) add(segmentStart, end)
  return { start, end, pipes, leading, trailing, cells }
}

export type Align = 'left' | 'center' | 'right'

/** The alignment each column of the delimiter line asks for (`:--`, `:-:`, `--:`). */
export function alignmentsOf(delimiterLine: string): Align[] {
  const row = splitRow(delimiterLine)
  return row.cells.map((cell) => {
    const text = delimiterLine.slice(cell.from, cell.to)
    if (text.startsWith(':') && text.endsWith(':') && text.length > 1) return 'center'
    return text.endsWith(':') ? 'right' : 'left'
  })
}

/**
 * Can this table be drawn as a grid? Only a table in the page itself: one inside a quote or a list item keeps its text
 * (its lines start with something that is not the table's).
 */
export function renderable(state: EditorState, table: SyntaxNode): boolean {
  for (let parent = table.parent; parent; parent = parent.parent)
    if (parent.name === 'Blockquote' || parent.name === 'ListItem') return false
  const first = state.doc.lineAt(table.from).number
  const last = state.doc.lineAt(table.to).number
  if (last - first < 1) return false
  for (let n = first; n <= last; n++) {
    const text = state.doc.line(n).text
    const row = splitRow(text)
    if (!/^ {0,3}$/.test(text.slice(0, row.start)) || row.cells.length === 0) return false
  }
  return true
}

/** The grid's column widths: proportional to the longest text in each column, never tiny and never all the width. */
function columns(lines: string[]): string {
  const widths: number[] = []
  lines.forEach((text, index) => {
    if (index === 1) return
    splitRow(text).cells.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] ?? 0, cell.to - cell.from)
    })
  })
  return widths.map((w) => `minmax(0, ${Math.min(48, Math.max(6, w))}fr)`).join(' ')
}

/** Holds the place of an empty cell that has no character at all between its pipes (`||`). */
class EmptyCell extends WidgetType {
  constructor(readonly align: Align) {
    super()
  }
  eq(other: EmptyCell): boolean {
    return other.align === this.align
  }
  toDOM(): HTMLElement {
    const dom = document.createElement('span')
    dom.className = 'live-cell'
    dom.setAttribute('aria-hidden', 'true')
    return dom
  }
}

const hidden = Decoration.replace({})
const pipeMark = Decoration.mark({ class: 'live-tablemark' })
const cellMarks: Record<Align, Decoration> = {
  left: Decoration.mark({ class: 'live-cell' }),
  center: Decoration.mark({ class: 'live-cell live-cell-center' }),
  right: Decoration.mark({ class: 'live-cell live-cell-right' })
}

type Add = (kind: string, from: number, to: number, deco: Decoration) => void

/** The decorations for the lines of `table` inside `range`. `revealed`: the cursor is in the table, so it shows as text. */
export function drawTable(
  state: EditorState,
  table: SyntaxNode,
  revealed: boolean,
  range: Extent,
  add: Add
): void {
  const doc = state.doc
  const first = doc.lineAt(table.from).number
  const last = doc.lineAt(table.to).number
  const grid = !revealed && renderable(state, table)
  const texts: string[] = []
  for (let n = first; n <= last; n++) texts.push(doc.line(n).text)
  const aligns = alignmentsOf(texts[1] ?? '')
  const template = grid ? columns(texts) : ''

  for (let n = first; n <= last; n++) {
    const line = doc.line(n)
    if (line.to < range.from || line.from > range.to) continue
    const index = n - first
    const row = splitRow(line.text)

    if (!grid) {
      add(
        'tline',
        line.from,
        line.from,
        Decoration.line({ class: index === 1 ? 'live-table live-table-delim' : 'live-table' })
      )
      if (index === 1) {
        if (row.end > row.start) add('tpipe', line.from + row.start, line.from + row.end, pipeMark)
        continue
      }
      for (const pipe of row.pipes) add('tpipe', line.from + pipe, line.from + pipe + 1, pipeMark)
      continue
    }

    if (index === 1) {
      add('tline', line.from, line.from, Decoration.line({ class: 'live-table-rule' }))
      if (line.length > 0) add('thide', line.from, line.to, hidden)
      continue
    }
    add(
      'tline',
      line.from,
      line.from,
      Decoration.line({
        class: index === 0 ? 'live-table-row live-table-head' : 'live-table-row',
        attributes: { style: `grid-template-columns: ${template}` }
      })
    )
    // What stays drawn in each cell; everything between is hidden.
    const shown: Extent[] = []
    row.cells.forEach((cell, i) => {
      const align = aligns[i] ?? 'left'
      if (cell.from < cell.to) shown.push({ from: cell.from, to: cell.to })
      else if (cell.gapFrom < cell.gapTo) shown.push({ from: cell.gapFrom, to: cell.gapFrom + 1 })
      else shown.push({ from: cell.gapFrom, to: cell.gapFrom })
      const at = shown[shown.length - 1]
      if (at.from < at.to) add('tcell', line.from + at.from, line.from + at.to, cellMarks[align])
      else
        add(
          'tcell',
          line.from + at.from,
          line.from + at.from,
          Decoration.widget({ widget: new EmptyCell(align), side: 1 })
        )
    })
    let done = 0
    for (const part of shown) {
      if (part.from > done) add('thide', line.from + done, line.from + part.from, hidden)
      done = part.to
    }
    if (done < line.length) add('thide', line.from + done, line.to, hidden)
  }
}

/** The cells a Tab can reach, in reading order: every line of the table but the delimiter line. */
interface Stop {
  line: number
  /** Document positions. */
  caret: number
  end: number
}

function stopsOf(state: EditorState, first: number, last: number): Stop[] {
  const stops: Stop[] = []
  for (let n = first; n <= last; n++) {
    if (n === first + 1) continue
    const line = state.doc.line(n)
    for (const cell of splitRow(line.text).cells) {
      const empty = cell.from === cell.to
      const caret = empty ? Math.min(cell.gapFrom + 1, cell.gapTo) : cell.from
      stops.push({ line: n, caret: line.from + caret, end: line.from + cell.gapTo })
    }
  }
  return stops
}

/**
 * Tab and Shift-Tab in a table: the cursor goes to the start of the next or previous cell, reading order, skipping the
 * delimiter line. Tab in the last cell adds an empty row under the table; Shift-Tab in the first cell stays put. Not a
 * table (or a selection that spans lines or ranges): not handled, so the list keys and the rest run as before.
 */
export const tableTab =
  (forward: boolean): StateCommand =>
  ({ state, dispatch }) => {
    const range = state.selection.main
    if (state.selection.ranges.length > 1) return false
    const line = state.doc.lineAt(range.head)
    if (state.doc.lineAt(range.anchor).number !== line.number) return false
    const found = enclosing(state, range.head, range.head, ['Table'])
    if (!found) return false
    const first = state.doc.lineAt(found.from).number
    const last = state.doc.lineAt(found.to).number
    if (last - first < 1) return false
    const stops = stopsOf(state, first, last)
    if (stops.length === 0) return false

    let current = -1
    let lastOnLine = -1
    for (let i = 0; i < stops.length; i++) {
      if (stops[i].line < line.number) continue
      if (stops[i].line > line.number) break
      lastOnLine = i
      if (range.head <= stops[i].end) {
        current = i
        break
      }
    }
    if (current < 0) current = lastOnLine
    let target: number
    if (current < 0) {
      // On the delimiter line: forward is the first cell below it, backward the last one above it.
      const below = stops.findIndex((stop) => stop.line > line.number)
      target = forward ? below : (below < 0 ? stops.length : below) - 1
    } else target = current + (forward ? 1 : -1)

    const go = (caret: number): true => {
      dispatch(state.update({ selection: EditorSelection.cursor(caret), scrollIntoView: true }))
      return true
    }
    if (target >= 0 && target < stops.length) return go(stops[target].caret)
    if (!forward || state.readOnly) return true

    // Past the last cell: a new empty row, with as many cells as the header and the pipes the last row has.
    const header = splitRow(state.doc.line(first).text)
    const lastLine = state.doc.line(last)
    const row = splitRow(lastLine.text)
    const prefix = lastLine.text.slice(0, row.start)
    const body = header.cells.map(() => '  ').join('|')
    const text = `${prefix}${row.leading ? '|' : ''}${body}${row.trailing ? '|' : ''}`
    const insert = withBreaks(state, `\n${text}`)
    // A line break is one position, whatever it is made of; the caret goes after the first cell's first space.
    const caret = lastLine.to + 1 + prefix.length + (row.leading ? 2 : 1)
    dispatch(
      state.update({
        changes: { from: lastLine.to, insert },
        selection: EditorSelection.cursor(caret),
        scrollIntoView: true,
        userEvent: 'input.table'
      })
    )
    return true
  }
