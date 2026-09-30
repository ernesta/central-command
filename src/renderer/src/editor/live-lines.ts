import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import type { Tree } from '@lezer/common'

export type BlockKind = 'none' | 'heading' | 'bullet' | 'ordered' | 'task'

/** One line of Markdown taken apart: `> > ` + `  ` + `- [ ] ` + the text. Joined again, the parts are the line. */
export interface LineParts {
  /** The quote markers, one `>` per level as typed (`> > `). */
  quote: string
  /** White space between the quote and the marker; the nesting of a list item. */
  indent: string
  /** `## `, `- `, `1. ` or `- [ ] `, with the single space after it; empty for a plain line. */
  marker: string
  kind: BlockKind
  /** The heading level, or the number of an ordered item. */
  level: number
  /** A task's box is ticked. */
  checked: boolean
  content: string
}

const QUOTE = /^(?: {0,3}>[ ]?)*/
const HEADING = /^(#{1,6})(?: |$)/
const TASK = /^[-*+] \[([ xX])\](?: |$)/
const BULLET = /^[-*+](?: |$)/
const ORDERED = /^(\d{1,9})[.)](?: |$)/

export function parseLine(text: string): LineParts {
  const quote = QUOTE.exec(text)?.[0] ?? ''
  const afterQuote = text.slice(quote.length)
  const indent = /^[ \t]*/.exec(afterQuote)?.[0] ?? ''
  const rest = afterQuote.slice(indent.length)
  const parts: LineParts = {
    quote,
    indent,
    marker: '',
    kind: 'none',
    level: 0,
    checked: false,
    content: rest
  }
  const take = (
    kind: BlockKind,
    match: RegExpExecArray,
    level = 0,
    checked = false
  ): LineParts => ({
    ...parts,
    kind,
    level,
    checked,
    marker: match[0],
    content: rest.slice(match[0].length)
  })
  let match: RegExpExecArray | null
  if ((match = HEADING.exec(rest))) return take('heading', match, match[1].length)
  if ((match = TASK.exec(rest))) return take('task', match, 0, match[1] !== ' ')
  if ((match = BULLET.exec(rest))) return take('bullet', match)
  if ((match = ORDERED.exec(rest))) return take('ordered', match, Number.parseInt(match[1], 10))
  return parts
}

export const isListKind = (kind: BlockKind): boolean =>
  kind === 'bullet' || kind === 'ordered' || kind === 'task'

/** The syntax tree, parsed far enough to cover `upTo` (the editor parses in the background; a key must not wait for it). */
export function treeTo(state: EditorState, upTo: number): Tree {
  return ensureSyntaxTree(state, Math.min(state.doc.length, upTo), 100) ?? syntaxTree(state)
}

/** The nearest node called `name` around `pos` (either side of it counts), or null. */
export function enclosing(
  state: EditorState,
  pos: number,
  to: number,
  names: readonly string[]
): { name: string; from: number; to: number; node: ReturnType<Tree['resolveInner']> } | null {
  const tree = treeTo(state, to + 1)
  for (const side of [1, -1] as const) {
    for (
      let node: ReturnType<Tree['resolveInner']> | null = tree.resolveInner(pos, side);
      node;
      node = node.parent
    ) {
      if (names.includes(node.name) && node.from <= pos && to <= node.to)
        return { name: node.name, from: node.from, to: node.to, node }
    }
  }
  return null
}

/** Is there a list marker where the line's marker starts (and not, say, an indented code block that looks like one)? */
export function listMarkAt(state: EditorState, lineFrom: number, parts: LineParts): boolean {
  if (!isListKind(parts.kind)) return false
  const at = lineFrom + parts.quote.length + parts.indent.length
  const node = treeTo(state, at + 1).resolveInner(at, 1)
  return node.name === 'ListMark' && node.from === at
}

/** `\n` in `text` as the note's own line break (`\r\n` in a Windows note; an insert with a bare `\n` there would keep it as a character). */
export const withBreaks = (state: EditorState, text: string): string =>
  text.replace(/\n/g, state.lineBreak)

/** How many positions `text` takes up in the document: a line break counts once, whatever it is made of. */
export const positions = (state: EditorState, text: string): number => state.toText(text).length
