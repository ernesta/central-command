import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import type { Extent } from './live-reveal'

/*
 * The space between blocks. It depends on what the blocks are and on how many blank lines separate them: none or one look the same,
 * because the first blank line is drawn with no height (`live-void`) and the line after it carries the gap
 * (`live-gap`, `live-gap-item`); each blank line after the first keeps its height (a run of n adds n - 1 lines). The cursor needs somewhere to be, so a first blank line with the cursor
 * on it takes the gap's height itself (`live-gap-cursor`) and the line after the run gives its gap up: the page does not move when the cursor comes or goes. Where that gap is not the block gap (a list's small one, a heading's own
 * padding), the cursor's blank line takes a line's height back instead. Blank lines inside code are code and keep theirs. Nothing here edits the text.
 *
 * Each line that holds text is one of: a heading (which pads itself), a list item, a quote line, a code line, a table row,
 * a rule, or a paragraph line (each line of paragraph text is its own paragraph, as the notes are written). Between two
 * lines of one block there is no gap (a list: a small one; a quote: a full one, as each of its lines is a paragraph); between blocks, and between paragraph lines, there is a gap.
 */

type Add = (kind: string, from: number, to: number, deco: Decoration) => void

type Kind = 'heading' | 'list' | 'quote' | 'code' | 'table' | 'rule' | 'paragraph'
interface Info {
  kind: Kind
  /** Where the block starts: two lines with the same kind and id are one block. */
  id: number
}

const isBlank = (text: string): boolean => /^[ \t]*$/.test(text)

const voidLine = Decoration.line({ class: 'live-void' })
const gapLine = Decoration.line({ class: 'live-gap' })
const itemGapLine = Decoration.line({ class: 'live-gap-item' })
const quoteGapLine = Decoration.line({ class: 'live-gap-quote' })
const cursorGapLine = Decoration.line({ class: 'live-gap-cursor' })
const padFirst = Decoration.line({ class: 'live-pad-first' })
const padLast = Decoration.line({ class: 'live-pad-last' })

/** What the (non-blank) line is part of. */
function infoOf(state: EditorState, lineFrom: number, text: string): Info {
  const indent = text.length - text.trimStart().length
  let quote: SyntaxNode | null = null
  let code: SyntaxNode | null = null
  let table: SyntaxNode | null = null
  let list: SyntaxNode | null = null
  let other: Info | null = null
  for (
    let n: SyntaxNode | null = syntaxTree(state).resolveInner(lineFrom + indent, 1);
    n;
    n = n.parent
  ) {
    if (n.name === 'Blockquote') quote = n
    else if (n.name === 'FencedCode' || n.name === 'CodeBlock') code = n
    else if (n.name === 'Table') table = n
    else if (n.name === 'BulletList' || n.name === 'OrderedList') list = n
    else if (/^(ATX|Setext)Heading/.test(n.name)) other = { kind: 'heading', id: n.from }
    else if (n.name === 'HorizontalRule') other = { kind: 'rule', id: n.from }
  }
  if (quote) return { kind: 'quote', id: quote.from }
  if (code) return { kind: 'code', id: code.from }
  if (table) return { kind: 'table', id: table.from }
  if (list) return { kind: 'list', id: list.from }
  return other ?? { kind: 'paragraph', id: lineFrom }
}

/** A blank line inside code is part of the code. */
function inCode(state: EditorState, lineFrom: number): boolean {
  for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(lineFrom, 1); n; n = n.parent)
    if (n.name === 'FencedCode' || n.name === 'CodeBlock') return true
  return false
}

const same = (a: Info, b: Info): boolean => a.kind === b.kind && a.id === b.id

export function drawSpacing(state: EditorState, range: Extent, add: Add): void {
  const doc = state.doc
  const memo = new Map<number, Info>()
  const info = (n: number): Info => {
    let found = memo.get(n)
    if (!found) {
      const line = doc.line(n)
      found = infoOf(state, line.from, line.text)
      memo.set(n, found)
    }
    return found
  }
  /** The nearest line with text above (`step` -1) or below (`step` 1), or 0. */
  const nearest = (n: number, step: 1 | -1): number => {
    for (let at = n + step; at >= 1 && at <= doc.lines; at += step)
      if (!isBlank(doc.line(at).text)) return at
    return 0
  }
  const cursorOn = (from: number, to: number): boolean =>
    state.selection.ranges.some((r) => r.head >= from && r.head <= to)

  /** The gap the text line `n` carries over the line before it. */
  const gapOf = (n: number): 'gap' | 'item' | 'quote' | null => {
    const before = nearest(n, -1)
    if (!before) return null
    const here = info(n)
    const prev = info(before)
    if (here.kind === 'heading' || prev.kind === 'heading') return null
    if (!same(prev, here)) return 'gap'
    return here.kind === 'list' ? 'item' : here.kind === 'quote' ? 'quote' : null
  }
  /** A blank line the cursor is on, with text above it (not in code): the text typed there would be a paragraph. */
  const cursorBlank = (n: number): boolean => {
    const line = doc.line(n)
    return (
      n > 1 &&
      isBlank(line.text) &&
      cursorOn(line.from, line.to) &&
      !inCode(state, line.from) &&
      nearest(n, -1) > 0
    )
  }
  /**
   * Whether text typed on the blank line `n` would carry a gap. Not under a heading (which pads itself), and not directly under a
   * list item or quote line, where the text would continue it.
   */
  const typedGap = (n: number): boolean => {
    const above = info(nearest(n, -1))
    if (above.kind === 'heading') return false
    return !((above.kind === 'list' || above.kind === 'quote') && !isBlank(doc.line(n - 1).text))
  }
  /** The blank line with the cursor in the run just above the text line `n` (0 if none). */
  const cursorInRunAbove = (n: number): number => {
    const before = nearest(n, -1)
    for (let m = n - 1; m > before && before > 0; m--) if (cursorBlank(m)) return m
    return 0
  }
  /** The cursor's blank line, when the text line after the run carries the block gap: the cursor's line takes that gap, so the run is as tall as with the cursor away. */
  const standsInForGap = (n: number): boolean => {
    if (!cursorBlank(n) || !typedGap(n)) return false
    const after = nearest(n, 1)
    if (!after) return false
    const gap = gapOf(after)
    return gap === 'gap' || gap === 'quote'
  }
  /** The first blank line of a run, with the cursor on it, in a run of two or more: the second blank line is the free one. */
  const takesLine = (n: number): boolean =>
    cursorBlank(n) &&
    !isBlank(doc.line(n - 1).text) &&
    n < doc.lines &&
    isBlank(doc.line(n + 1).text)

  const first = doc.lineAt(range.from).number
  const lastLine = doc.lineAt(range.to).number
  for (let n = first; n <= lastLine; n++) {
    const line = doc.line(n)
    if (isBlank(line.text)) {
      // The cursor's blank line is drawn as the paragraph typed there would be, gap included, so typing moves nothing. The text
      // after the run gives its gap up (`stoodIn`), so the run is as tall as with the cursor away. A single blank line is just
      // the gap itself (`live-gap-cursor`: the caret sits in the middle of it).
      if (cursorBlank(n) && typedGap(n)) {
        const alone =
          !isBlank(doc.line(n - 1).text) && n < doc.lines && !isBlank(doc.line(n + 1).text)
        add('gap', line.from, line.from, alone && standsInForGap(n) ? cursorGapLine : gapLine)
      }
      if (cursorOn(line.from, line.to) || inCode(state, line.from)) continue
      // Only the first blank line of a run is free; each one after it keeps a line's height, so Enter on an empty line
      // shows (when the cursor is on the first, the second is the free one). A note's empty last line (the final line break)
      // is the end of the file, never part of a run.
      const endBreak = n === doc.lines && n > 1 && line.length === 0
      const free =
        n === 1 ||
        !isBlank(doc.line(n - 1).text) ||
        (n > 2 && !isBlank(doc.line(n - 2).text) && takesLine(n - 1))
      if (endBreak || free) add('void', line.from, line.from, voidLine)
      continue
    }
    const here = info(n)
    const before = nearest(n, -1)
    const after = nearest(n, 1)
    const prev = before ? info(before) : null
    const next = after ? info(after) : null

    const gap = gapOf(n)
    // The cursor's blank line in the run before this line stands in for the gap while the cursor is on it.
    const standing = cursorInRunAbove(n)
    const stoodIn = standing > 0 && standsInForGap(standing)
    if (gap && !stoodIn)
      add(
        'gap',
        line.from,
        line.from,
        gap === 'gap' ? gapLine : gap === 'item' ? itemGapLine : quoteGapLine
      )
    if (here.kind === 'quote' || here.kind === 'code') {
      if (!prev || !same(prev, here)) add('padfirst', line.from, line.from, padFirst)
      if (!next || !same(next, here)) add('padlast', line.from, line.from, padLast)
    }
  }
}
