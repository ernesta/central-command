import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import type { Extent } from './live-reveal'

/*
 * The space between lines. Every line of the note is one unit, a blank line included: a line of text is its own paragraph (the
 * notes are written that way), so it carries the block gap above it (`live-gap`) and a blank line carries the gap the text typed on
 * it would carry, so typing there moves nothing and the cursor never changes the layout. Where the gap is not the block gap it is the
 * list's small one (`live-gap-item`), a quote's (`live-gap-quote`), or none (a heading pads itself, code keeps its own blank lines,
 * and the first line of a note has nothing above it). A blank line is therefore real: n blank lines are n lines of space.
 * The note's empty last line (the final line break) is the end of the file and is drawn with no height until the cursor goes there.
 * Nothing here edits the text.
 */

type Add = (kind: string, from: number, to: number, deco: Decoration) => void

export type Kind = 'heading' | 'list' | 'quote' | 'code' | 'table' | 'rule' | 'paragraph'
export interface Info {
  kind: Kind
  /** Where the block starts: two lines with the same kind and id are one block. */
  id: number
}

const isBlank = (text: string): boolean => /^[ \t]*$/.test(text)

const gapLine = Decoration.line({ class: 'live-gap' })
const itemGapLine = Decoration.line({ class: 'live-gap-item' })
const quoteGapLine = Decoration.line({ class: 'live-gap-quote' })
const padFirst = Decoration.line({ class: 'live-pad-first' })
const padLast = Decoration.line({ class: 'live-pad-last' })

/** What the (non-blank) line is part of. */
export function infoOf(state: EditorState, lineFrom: number, text: string): Info {
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

  /** The gap the line `n` (text, or blank as the paragraph typed there would be) carries over the line before it. */
  const gapOf = (n: number): 'gap' | 'item' | 'quote' | null => {
    const before = nearest(n, -1)
    if (!before) return null
    const line = doc.line(n)
    const blank = isBlank(line.text)
    const prev = info(before)
    if (prev.kind === 'heading') return null
    if (blank) {
      // Blank lines after the first of a run start a paragraph; the first continues what is above it.
      if (before < n - 1) return 'gap'
      return prev.kind === 'list' ? 'item' : prev.kind === 'quote' ? 'quote' : 'gap'
    }
    const here = info(n)
    if (here.kind === 'heading') return null
    // Text after a blank line is a new paragraph, except inside code (a blank line there is code).
    if (before < n - 1 && !(same(prev, here) && here.kind === 'code')) return 'gap'
    if (!same(prev, here)) return 'gap'
    return here.kind === 'list' ? 'item' : here.kind === 'quote' ? 'quote' : null
  }

  const first = doc.lineAt(range.from).number
  const lastLine = doc.lineAt(range.to).number
  for (let n = first; n <= lastLine; n++) {
    const line = doc.line(n)
    const blank = isBlank(line.text)
    if (blank && inCode(state, line.from)) continue
    // The empty last line is the end of the file, drawn with no height (`live-endbreak`) unless the cursor is on it.
    if (blank && n === doc.lines && n > 1 && line.length === 0 && !cursorOn(line.from, line.to))
      continue

    const gap = gapOf(n)
    if (gap)
      add(
        'gap',
        line.from,
        line.from,
        gap === 'gap' ? gapLine : gap === 'item' ? itemGapLine : quoteGapLine
      )
    if (blank) continue

    const here = info(n)
    const before = nearest(n, -1)
    const after = nearest(n, 1)
    const prev = before ? info(before) : null
    const next = after ? info(after) : null
    if (here.kind === 'quote' || here.kind === 'code') {
      if (!prev || !same(prev, here)) add('padfirst', line.from, line.from, padFirst)
      if (!next || !same(next, here)) add('padlast', line.from, line.from, padLast)
    }
  }
}
