import {
  EditorSelection,
  type ChangeSpec,
  type EditorState,
  type Line,
  type SelectionRange,
  type StateCommand,
  type Transaction
} from '@codemirror/state'
import type { SyntaxNode } from '@lezer/common'
import { linesOf } from './live-format'
import {
  enclosing,
  isListKind,
  listMarkAt,
  parseLine,
  positions,
  treeTo,
  withBreaks,
  type LineParts
} from './live-lines'

/*
 * Enter, Shift-Enter, Backspace, Delete, Tab and Shift-Tab in lists and quotes. The document is the Markdown text, so
 * every rule is an edit of text; a bullet or checkbox is drawn as a unit (`live-widgets.ts`) and these rules are what
 * make it behave as one. Each returns false when it has nothing to say, so the ordinary key runs.
 */

const blankLine = (parts: LineParts): boolean => parts.marker === '' && parts.content.trim() === ''

/** Where the text of the line starts: after the quote markers, the nesting and the marker. */
const contentStart = (line: Line, parts: LineParts): number =>
  line.from + parts.quote.length + parts.indent.length + parts.marker.length

/** Where the drawn prefix starts: after the quote markers. */
const prefixStart = (line: Line, parts: LineParts): number => line.from + parts.quote.length

function inCode(state: EditorState, pos: number): boolean {
  return enclosing(state, pos, pos, ['FencedCode', 'CodeBlock']) !== null
}

/** How far a child of this item is indented: the width of its marker and the spaces after it (not a task's box). */
function childIndent(parts: LineParts): number {
  const marker = parts.kind === 'task' ? parts.marker.slice(0, 2) : parts.marker.trimEnd()
  const spaces = parts.kind === 'task' ? 1 : /^ */.exec(parts.marker + parts.content)?.[0].length
  const after = Math.min(spaces ?? 1, 4)
  return marker.length + Math.max(after, 1) - (parts.kind === 'task' ? 1 : 0)
}

interface ItemAt {
  node: SyntaxNode
  line: Line
  parts: LineParts
}

/** The list item whose first line is `line`, or null (a line that only looks like one, or is not one). */
function itemStartingAt(state: EditorState, line: Line): ItemAt | null {
  const parts = parseLine(line.text)
  if (!listMarkAt(state, line.from, parts)) return null
  const mark = treeTo(state, line.to + 1).resolveInner(
    line.from + parts.quote.length + parts.indent.length,
    1
  )
  const node = mark.parent
  return node?.name === 'ListItem' ? { node, line, parts } : null
}

/** The lines of an item, its nested items and continuation lines included. */
function itemLines(state: EditorState, node: SyntaxNode): Line[] {
  const lines: Line[] = []
  const last = state.doc.lineAt(node.to).number
  for (let n = state.doc.lineAt(node.from).number; n <= last; n++) lines.push(state.doc.line(n))
  return lines
}

/** The items whose first line is in the selection; one inside another is left out, for it moves with the outer one. */
function selectedItems(state: EditorState): ItemAt[] {
  const found: ItemAt[] = []
  for (const range of state.selection.ranges)
    for (const line of linesOf(state, range)) {
      const item = itemStartingAt(state, line)
      if (item && !found.some((other) => other.node.from === item.node.from)) found.push(item)
    }
  found.sort((a, b) => a.node.from - b.node.from)
  const top: ItemAt[] = []
  for (const item of found) {
    const previous = top[top.length - 1]
    if (!previous || item.node.from >= previous.node.to) top.push(item)
  }
  return top
}

function apply(
  state: EditorState,
  changes: ChangeSpec[],
  dispatch: (tr: Transaction) => void
): void {
  const set = state.changes(changes)
  dispatch(
    state.update({
      changes: set,
      selection: state.selection.map(set),
      scrollIntoView: true,
      userEvent: 'format.list'
    })
  )
}

/** Indent each selected item under the item before it. The first item of a list cannot nest, and does nothing. */
export const indentItem: StateCommand = ({ state, dispatch }) => {
  const items = selectedItems(state)
  if (items.length === 0) return false
  const changes: ChangeSpec[] = []
  for (const item of items) {
    const before = item.node.prevSibling
    if (before?.name !== 'ListItem') continue
    const previous = itemStartingAt(state, state.doc.lineAt(before.from))
    if (!previous) continue
    const pad = ' '.repeat(childIndent(previous.parts))
    for (const line of itemLines(state, item.node)) {
      const parts = parseLine(line.text)
      if (blankLine(parts)) continue
      changes.push({ from: line.from + parts.quote.length, insert: pad })
    }
  }
  if (changes.length > 0) apply(state, changes, dispatch)
  return true
}

/** The lines of `item` with the nesting taken off one level, or null when it is not nested. */
function outdentChanges(state: EditorState, item: ItemAt): ChangeSpec[] | null {
  const parentItem = item.node.parent?.parent
  if (parentItem?.name !== 'ListItem') return null
  const parent = itemStartingAt(state, state.doc.lineAt(parentItem.from))
  const amount = item.parts.indent.length - (parent?.parts.indent.length ?? 0)
  const width = amount > 0 ? amount : item.parts.indent.length
  const changes: ChangeSpec[] = []
  for (const line of itemLines(state, item.node)) {
    const parts = parseLine(line.text)
    const remove = Math.min(width, parts.indent.length)
    if (remove > 0)
      changes.push({
        from: line.from + parts.quote.length,
        to: line.from + parts.quote.length + remove
      })
  }
  return changes
}

/** Move each selected item out a level. At the top level there is nothing to do. */
export const outdentItem: StateCommand = ({ state, dispatch }) => {
  const items = selectedItems(state)
  if (items.length === 0) return false
  const changes = items.flatMap((item) => outdentChanges(state, item) ?? [])
  if (changes.length > 0) apply(state, changes, dispatch)
  return true
}

/**
 * Backspace at the start of an item's text: a nested item moves out a level; a top-level one loses its bullet,
 * number or checkbox as one step and becomes a paragraph (with a blank line before it when it would otherwise
 * run into the line above). Just before the drawn marker, at the start of the line, it joins the line above,
 * text to text, as Delete does from the other side.
 */
export const backspaceInItem: StateCommand = ({ state, dispatch }) => {
  const range = state.selection.main
  if (!range.empty || state.selection.ranges.length > 1) return false
  const line = state.doc.lineAt(range.head)
  const item = itemStartingAt(state, line)
  if (!item) return false
  const { parts } = item
  if (range.head === contentStart(line, parts)) {
    const outdent = outdentChanges(state, item)
    if (outdent) {
      if (outdent.length > 0) apply(state, outdent, dispatch)
      return true
    }
    const above = line.number > 1 ? state.doc.line(line.number - 1) : null
    const runsIntoAbove =
      above !== null &&
      !blankLine(parseLine(above.text)) &&
      enclosing(state, above.to, above.to, ['Paragraph']) !== null
    const at = prefixStart(line, parts)
    const changes: ChangeSpec[] = [{ from: at, to: contentStart(line, parts) }]
    // A blank line keeps the quote, if there is one, without its trailing space.
    if (runsIntoAbove)
      changes.push({ from: line.from, insert: withBreaks(state, `${parts.quote.trimEnd()}\n`) })
    const set = state.changes(changes)
    dispatch(
      state.update({
        changes: set,
        selection: EditorSelection.cursor(
          at + (runsIntoAbove ? parts.quote.trimEnd().length + 1 : 0)
        ),
        scrollIntoView: true,
        userEvent: 'delete.list'
      })
    )
    return true
  }
  if (range.head === prefixStart(line, parts) && parts.quote === '' && line.number > 1) {
    const above = state.doc.line(line.number - 1)
    if (blankLine(parseLine(above.text)) || inCode(state, above.to)) return false
    dispatch(
      state.update({
        changes: { from: above.to, to: contentStart(line, parts) },
        selection: EditorSelection.cursor(above.to),
        scrollIntoView: true,
        userEvent: 'delete.list'
      })
    )
    return true
  }
  return false
}

/** Delete at the end of a line, when the next line is a list item: join its text on, without its marker. */
export const deleteBeforeItem: StateCommand = ({ state, dispatch }) => {
  const range = state.selection.main
  if (!range.empty || state.selection.ranges.length > 1) return false
  const line = state.doc.lineAt(range.head)
  if (range.head !== line.to || line.number === state.doc.lines) return false
  if (blankLine(parseLine(line.text)) || inCode(state, line.to)) return false
  const next = state.doc.line(line.number + 1)
  const item = itemStartingAt(state, next)
  if (!item) return false
  dispatch(
    state.update({
      changes: { from: line.to, to: contentStart(next, item.parts) },
      selection: EditorSelection.cursor(line.to),
      scrollIntoView: true,
      userEvent: 'delete.list'
    })
  )
  return true
}

/** Width of a list item's marker without its box: what a continuation line is indented by. */
function continuationIndent(parts: LineParts): string {
  return ' '.repeat(parts.indent.length + (isListKind(parts.kind) ? childIndent(parts) : 0))
}

/** The marker the next item starts with. */
function nextMarker(parts: LineParts): string {
  if (parts.kind === 'ordered') {
    const delimiter = parts.marker.trimEnd().slice(-1)
    return `${parts.level + 1}${delimiter} `
  }
  if (parts.kind === 'task') return `${parts.marker.slice(0, 1)} [ ] `
  return parts.marker
}

/** Renumber the items after this one when the list counted up by one, as it did before the new item went in. */
function renumberAfter(state: EditorState, item: ItemAt): ChangeSpec[] {
  if (item.parts.kind !== 'ordered') return []
  const following: SyntaxNode[] = []
  for (let sibling = item.node.nextSibling; sibling; sibling = sibling.nextSibling)
    if (sibling.name === 'ListItem') following.push(sibling)
  const numbers = following.map((sibling) => {
    const mark = sibling.getChild('ListMark')
    return mark
      ? { mark, value: Number.parseInt(state.doc.sliceString(mark.from, mark.to), 10) }
      : null
  })
  const counted = numbers.every(
    (entry, i) => entry !== null && entry.value === item.parts.level + 1 + i
  )
  if (!counted) return []
  return numbers.flatMap((entry, i) => {
    if (!entry) return []
    const digits = String(entry.value).length
    return [
      {
        from: entry.mark.from,
        to: entry.mark.from + digits,
        insert: String(item.parts.level + 2 + i)
      }
    ]
  })
}

type Edit = { changes: ChangeSpec; range: SelectionRange }

function enterAt(state: EditorState, range: SelectionRange): Edit {
  const line = state.doc.lineAt(range.from)
  const parts = parseLine(line.text)
  const start = contentStart(line, parts)
  const newline = (text: string, extra: ChangeSpec[] = []): Edit => {
    const insert = withBreaks(state, text)
    return {
      changes: [{ from: range.from, to: range.to, insert }, ...extra],
      range: EditorSelection.cursor(range.from + positions(state, insert))
    }
  }
  const keepIndent = (): Edit =>
    newline(`\n${/^[ \t]*/.exec(line.text.slice(0, range.from - line.from))?.[0] ?? ''}`)
  // In the marker itself, or in code, Enter is a plain new line.
  if (range.from < start) return newline('\n')
  if (inCode(state, range.from)) return keepIndent()

  const item = isListKind(parts.kind) ? itemStartingAt(state, line) : null
  const rest = state.doc.sliceString(range.to, line.to)
  const empty = range.empty && parts.content.trim() === '' && rest.trim() === ''
  if (empty && item) {
    const outdent = outdentChanges(state, item)
    if (outdent) {
      // An empty nested item moves out a level first.
      return {
        changes: outdent,
        range: EditorSelection.cursor(state.changes(outdent).mapPos(range.from))
      }
    }
    // The item ends: its marker goes, the quote (if any) stays.
    const at = prefixStart(line, parts)
    return { changes: { from: at, to: line.to }, range: EditorSelection.cursor(at) }
  }
  if (empty && parts.kind === 'none' && parts.quote !== '') {
    // An empty quoted line: out of the quote altogether, however deep.
    return { changes: { from: line.from, to: line.to }, range: EditorSelection.cursor(line.from) }
  }
  if (parts.kind === 'heading') return newline(`\n${parts.quote}`)
  if (item)
    return newline(
      `\n${parts.quote}${parts.indent}${nextMarker(parts)}`,
      renumberAfter(state, item)
    )
  return parts.quote === '' && parts.indent === ''
    ? keepIndent()
    : newline(`\n${parts.quote}${parts.indent}`)
}

/**
 * Enter. On a list item or a quoted line it starts the next one (a checkbox comes back unticked, a number counts up
 * and the numbers below follow); on an empty item it ends the list, a nested one moving out a level first; on an
 * empty quoted line it leaves the quote, however deep. Elsewhere it is a new line that keeps the indentation.
 */
export const enter: StateCommand = ({ state, dispatch }) => {
  if (state.readOnly) return false
  dispatch(
    state.update(
      state.changeByRange((range) => enterAt(state, range)),
      { scrollIntoView: true, userEvent: 'input' }
    )
  )
  return true
}

/** Shift-Enter: a line break inside the paragraph, written as a backslash at the end of the line. */
export const hardBreak: StateCommand = ({ state, dispatch }) => {
  if (state.readOnly) return false
  const result = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from)
    const parts = parseLine(line.text)
    const insideMarker = range.from < contentStart(line, parts)
    // A heading, code or the marker itself takes no backslash: it is an ordinary new line.
    const plain = parts.kind === 'heading' || insideMarker || inCode(state, range.from)
    const insert = withBreaks(
      state,
      plain ? '\n' : `\\\n${parts.quote}${continuationIndent(parts)}`
    )
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(range.from + positions(state, insert))
    }
  })
  dispatch(state.update(result, { scrollIntoView: true, userEvent: 'input' }))
  return true
}
