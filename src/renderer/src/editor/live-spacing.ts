import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import type { Extent } from './live-reveal'

/*
 * The space between blocks. It depends on what the blocks are and on how many blank lines separate them: none or one look the same,
 * because the first blank line is drawn with no height (`live-void`) and the line after it carries the gap
 * (`live-gap`, `live-gap-item`); each blank line after the first keeps its height (a run of n adds n - 1 lines). A blank line takes its height back while the cursor is on it, so the cursor has somewhere to
 * be; blank lines inside code are code and keep theirs. Nothing here edits the text.
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

  const first = doc.lineAt(range.from).number
  const lastLine = doc.lineAt(range.to).number
  for (let n = first; n <= lastLine; n++) {
    const line = doc.line(n)
    if (isBlank(line.text)) {
      if (cursorOn(line.from, line.to) || inCode(state, line.from)) continue
      // Only the first blank line of a run is free; each one after it keeps a line's height, so Enter on an empty line
      // shows. A note's empty last line (the final line break) is the end of the file, never part of a run.
      const endBreak = n === doc.lines && n > 1 && line.length === 0
      if (endBreak || n === 1 || !isBlank(doc.line(n - 1).text))
        add('void', line.from, line.from, voidLine)
      continue
    }
    const here = info(n)
    const before = nearest(n, -1)
    const after = nearest(n, 1)
    const prev = before ? info(before) : null
    const next = after ? info(after) : null

    if (prev && here.kind !== 'heading' && prev.kind !== 'heading') {
      if (!same(prev, here)) add('gap', line.from, line.from, gapLine)
      else if (here.kind === 'list') add('gap', line.from, line.from, itemGapLine)
      else if (here.kind === 'quote') add('gap', line.from, line.from, quoteGapLine)
    }
    if (here.kind === 'quote' || here.kind === 'code') {
      if (!prev || !same(prev, here)) add('padfirst', line.from, line.from, padFirst)
      if (!next || !same(next, here)) add('padlast', line.from, line.from, padLast)
    }
  }
}
