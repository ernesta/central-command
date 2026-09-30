import {
  ChangeSet,
  EditorSelection,
  type ChangeSpec,
  type EditorState,
  type Line,
  type SelectionRange,
  type StateCommand
} from '@codemirror/state'
import { enclosing, isListKind, parseLine, treeTo, type LineParts } from './live-lines'

/*
 * The formatting keys (Bold, Italic, Strikethrough, Inline code; headings, plain paragraph, quote, lists, code block).
 * The document is the Markdown text, so each key is an edit of that text: it puts markers in, or takes them out.
 * Typing the markers by hand gives the same result.
 */

interface InlineKind {
  marker: string
  /** The syntax node the pair makes, and the name of its marker children. */
  node: string
  mark: string
}

export const INLINE_KINDS = {
  bold: { marker: '**', node: 'StrongEmphasis', mark: 'EmphasisMark' },
  italic: { marker: '*', node: 'Emphasis', mark: 'EmphasisMark' },
  strike: { marker: '~~', node: 'Strikethrough', mark: 'StrikethroughMark' },
  code: { marker: '`', node: 'InlineCode', mark: 'CodeMark' }
} satisfies Record<string, InlineKind>

type Outcome = { changes: ChangeSet; range: SelectionRange }

/** The result of an edit for `changeByRange`: the changes, and the selection carried through them. */
function outcome(
  state: EditorState,
  spec: ChangeSpec,
  range: SelectionRange,
  assoc: 1 | -1 = 1
): Outcome {
  const changes = state.changes(spec)
  return {
    changes,
    range: EditorSelection.range(
      changes.mapPos(range.anchor, assoc),
      changes.mapPos(range.head, assoc)
    )
  }
}

function markRanges(
  node: { getChildren(name: string): { from: number; to: number }[] },
  kind: InlineKind
): { from: number; to: number }[] {
  const marks = node.getChildren(kind.mark)
  return marks.length >= 2 ? [marks[0], marks[marks.length - 1]] : []
}

/** Take the pair of markers off the span. */
function unmark(
  state: EditorState,
  kind: InlineKind,
  span: NonNullable<ReturnType<typeof enclosing>>,
  range: SelectionRange
): Outcome {
  const marks = markRanges(span.node, kind)
  if (marks.length === 0) return { changes: state.changes([]), range }
  return outcome(
    state,
    marks.map(({ from, to }) => ({ from, to })),
    range
  )
}

/** Put the pair round `from`–`to`, taking out pairs of the same kind already inside it (else `**a **b** c**`). */
function wrap(
  state: EditorState,
  kind: InlineKind,
  from: number,
  to: number,
  range: SelectionRange,
  cursorOnly: boolean
): Outcome {
  const changes: ChangeSpec[] = []
  treeTo(state, to + 1).iterate({
    from,
    to,
    enter(node) {
      if (node.name !== kind.node || node.from < from || node.to > to) return
      for (const mark of markRanges(node.node, kind)) changes.push({ from: mark.from, to: mark.to })
    }
  })
  changes.push({ from, insert: kind.marker }, { from: to, insert: kind.marker })
  const set = state.changes(changes)
  if (cursorOnly) {
    // A cursor in a word stays where it was in the word.
    const at = set.mapPos(range.head, range.head === from ? 1 : -1)
    return { changes: set, range: EditorSelection.cursor(at) }
  }
  const start = set.mapPos(from, 1)
  const end = set.mapPos(to, -1)
  return {
    changes: set,
    range:
      range.anchor > range.head
        ? EditorSelection.range(end, start)
        : EditorSelection.range(start, end)
  }
}

function inlineChange(state: EditorState, kind: InlineKind, range: SelectionRange): Outcome {
  const { doc } = state
  const { marker } = kind
  if (!range.empty) {
    const span = enclosing(state, range.from, range.to, [kind.node])
    if (span) return unmark(state, kind, span, range)
    const text = doc.sliceString(range.from, range.to)
    const lead = text.length - text.trimStart().length
    const trail = text.length - text.trimEnd().length
    // White space at the edges stays outside the markers, or the pair would not count as one.
    if (lead < text.length)
      return wrap(state, kind, range.from + lead, range.to - trail, range, false)
  }
  const at = range.head
  const span = enclosing(state, at, at, [kind.node])
  if (span) return unmark(state, kind, span, range)
  // Between an empty pair: take it away again.
  if (
    doc.sliceString(at - marker.length, at) === marker &&
    doc.sliceString(at, at + marker.length) === marker
  )
    return outcome(state, { from: at - marker.length, to: at + marker.length }, range)
  const word = state.wordAt(at)
  if (word) return wrap(state, kind, word.from, word.to, EditorSelection.cursor(at), true)
  return {
    changes: state.changes({ from: at, insert: marker + marker }),
    range: EditorSelection.cursor(at + marker.length)
  }
}

/** Bold, italic, strikethrough or code: wrap the selection or word in its markers, or take them off again. */
export const toggleInline =
  (kind: InlineKind): StateCommand =>
  ({ state, dispatch }) => {
    dispatch(
      state.update(
        state.changeByRange((range) => inlineChange(state, kind, range)),
        { scrollIntoView: true, userEvent: 'format.inline' }
      )
    )
    return true
  }

/** The lines the range covers; a selection that ends at the start of a line (a triple-click) does not include it. */
export function linesOf(state: EditorState, range: SelectionRange): Line[] {
  const { doc } = state
  const first = doc.lineAt(range.from)
  let end = range.to
  if (!range.empty && end > first.to && doc.lineAt(end).from === end) end -= 1
  const lines: Line[] = []
  for (let pos = first.from; pos <= Math.max(end, first.from);) {
    const line = doc.lineAt(pos)
    lines.push(line)
    pos = line.to + 1
  }
  return lines
}

interface Item {
  line: Line
  parts: LineParts
}

/** What a marker replaces: from the end of the quote markers to the end of the line's own marker. */
function prefixRange(item: Item): { from: number; to: number } {
  const { line, parts } = item
  const from = line.from + parts.quote.length
  return { from, to: from + parts.indent.length + parts.marker.length }
}

const blank = (item: Item): boolean =>
  item.parts.kind === 'none' && item.parts.content.trim() === ''

function blockCommand(build: (items: Item[]) => ChangeSpec[]): StateCommand {
  return ({ state, dispatch }) => {
    dispatch(
      state.update(
        state.changeByRange((range) => {
          const items = linesOf(state, range).map((line) => ({ line, parts: parseLine(line.text) }))
          const spec = build(items)
          return spec.length === 0 ? { range } : outcome(state, spec, range)
        }),
        { scrollIntoView: true, userEvent: 'format.block' }
      )
    )
    return true
  }
}

/** Replace each line's own marker; a list item keeps its nesting when it stays a list item. */
function setMarker(
  items: Item[],
  marker: (item: Item, rank: number) => string,
  keepIndent = false
): ChangeSpec[] {
  const many = items.length > 1
  let rank = 0
  const changes: ChangeSpec[] = []
  for (const item of items) {
    if (many && blank(item)) continue
    rank += 1
    const { from, to } = prefixRange(item)
    const indent = keepIndent && isListKind(item.parts.kind) ? item.parts.indent : ''
    changes.push({ from, to, insert: indent + marker(item, rank) })
  }
  return changes
}

/** Heading 1 to 6: sets or changes the level (Mod-Alt-0 takes it off). */
export const setHeading = (level: number): StateCommand =>
  blockCommand((items) => setMarker(items, () => `${'#'.repeat(level)} `))

/** Plain paragraph: no heading or list marker. */
export const setParagraph: StateCommand = blockCommand((items) =>
  items.filter((item) => item.parts.marker !== '').map(prefixRange)
)

/** Bulleted list: every line becomes an item, or, when they all are already, none of them. */
export const toggleBullets: StateCommand = blockCommand((items) => {
  const lines = items.filter((item) => items.length === 1 || !blank(item))
  if (lines.every((item) => item.parts.kind === 'bullet' || item.parts.kind === 'task'))
    return lines.map(prefixRange)
  return setMarker(
    items,
    (item) =>
      item.parts.kind === 'bullet' || item.parts.kind === 'task' ? item.parts.marker : '- ',
    true
  )
})

/** Numbered list: 1., 2., 3. down the lines, or off again when they all are numbered. */
export const toggleNumbers: StateCommand = blockCommand((items) => {
  const lines = items.filter((item) => items.length === 1 || !blank(item))
  if (lines.every((item) => item.parts.kind === 'ordered')) return lines.map(prefixRange)
  return setMarker(items, (_item, rank) => `${rank}. `, true)
})

/** Quote: one more `>` on every line, or, when they are all quoted, one fewer. */
export const toggleQuote: StateCommand = blockCommand((items) => {
  const lines = items.filter((item) => items.length === 1 || !blank(item))
  if (lines.every((item) => item.parts.quote !== '')) {
    return lines.map((item) => {
      const first = /^ {0,3}>[ ]?/.exec(item.line.text)?.[0] ?? ''
      return { from: item.line.from, to: item.line.from + first.length }
    })
  }
  // A blank line inside a selected block stays part of the quote, without a trailing space.
  return items.map((item) => ({
    from: item.line.from,
    insert: items.length > 1 && blank(item) ? '>' : '> '
  }))
})

/** Code block: wrap the lines in a fence, or, inside one, take the fence lines away. */
export const toggleCodeBlock: StateCommand = ({ state, dispatch }) => {
  const { doc } = state
  const range = state.selection.main
  const fenced = enclosing(state, range.from, range.to, ['FencedCode'])
  if (fenced) {
    const marks = fenced.node.getChildren('CodeMark')
    const open = doc.lineAt(fenced.from)
    const close = marks.length >= 2 ? doc.lineAt(marks[marks.length - 1].from) : null
    const changes: ChangeSpec[] = [{ from: open.from, to: Math.min(doc.length, open.to + 1) }]
    if (close && close.number > open.number) changes.push({ from: close.from - 1, to: close.to })
    dispatch(
      state.update(outcome(state, changes, range), {
        scrollIntoView: true,
        userEvent: 'format.block'
      })
    )
    return true
  }
  const lines = linesOf(state, range)
  const first = lines[0]
  const last = lines[lines.length - 1]
  const quote = parseLine(first.text).quote
  const fence = `${quote}\`\`\``
  if (lines.length === 1 && first.text.slice(quote.length).trim() === '') {
    // An empty line: an empty fence with the cursor inside it (the line may already hold the quote markers).
    const opening = fence.slice(quote.length)
    dispatch(
      state.update({
        changes: { from: first.to, insert: `${opening}\n${quote}\n${fence}` },
        selection: { anchor: first.to + opening.length + 1 + quote.length },
        scrollIntoView: true,
        userEvent: 'format.block'
      })
    )
    return true
  }
  const set = state.changes([
    { from: first.from, insert: `${fence}\n` },
    { from: last.to, insert: `\n${fence}` }
  ])
  dispatch(
    state.update({
      changes: set,
      selection: EditorSelection.range(
        set.mapPos(range.anchor, range.anchor === last.to ? -1 : 1),
        set.mapPos(range.head, range.head === last.to ? -1 : 1)
      ),
      scrollIntoView: true,
      userEvent: 'format.block'
    })
  )
  return true
}
