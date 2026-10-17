import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { scan } from '@shared/sections'
import { infoOf, type Kind } from './live-spacing'
import { decorationsOf, stateFor } from './live-test-utils'

/*
 * `npm run tidy:paragraph-blanks` (stage 2 of `docs/UNIFORM_LINES_PLAN.md`): a single blank line between two blocks is a whole line of
 * space in the editor (every line is one unit), so the ones between two paragraph lines can go. Outside this app those two lines would
 * become one paragraph, so a removal is only kept when the editor reads the note the same afterwards: every non-blank line has the
 * same syntax nodes and the same decorations (the spacing classes aside) before and after. Only blank lines are ever removed.
 * (The parse helpers come from `live-test-utils`: they build a state with the whole note parsed, which is what a script needs too.)
 */

/** One single blank line between two lines of text, outside code fences. `line` is its index among the body's lines. */
export interface SingleBlank {
  line: number
  above: Kind
  below: Kind
}

/** The label of a pair, in one order whichever way round it is: `list + paragraph`, `heading + paragraph`. */
export function pairLabel(a: Kind, b: Kind): string {
  return a === b ? `${a} + ${a}` : [a, b].sort().join(' + ')
}

/** The body with LF breaks only, for the parser (a line is the same line either way). */
const lf = (body: string): string => body.replace(/\r\n/g, '\n')

/** Every blank line that is alone (the lines on both sides have text) and not inside a code fence. */
export function singleBlanks(body: string): SingleBlank[] {
  const raw = body.split('\n')
  const { lines } = scan(body)
  const state = stateFor(lf(body))
  const text = (i: number): boolean => !lines[i].inFence && raw[i].trim() !== ''
  const last = raw.length > 1 && raw[raw.length - 1] === '' ? raw.length - 1 : -1
  const kind = (i: number): Kind => {
    const line = state.doc.line(i + 1)
    return infoOf(state, line.from, line.text).kind
  }
  const found: SingleBlank[] = []
  for (let i = 1; i < raw.length - 1; i++) {
    if (i === last || lines[i].inFence || raw[i].trim() !== '') continue
    if (!text(i - 1) || !text(i + 1)) continue
    found.push({ line: i, above: kind(i - 1), below: kind(i + 1) })
  }
  return found
}

/** The body without the lines at these indexes. */
export function dropLines(body: string, drop: number[]): string {
  const gone = new Set(drop)
  return body
    .split('\n')
    .filter((_, i) => !gone.has(i))
    .join('\n')
}

/** What the editor makes of each non-blank line: its syntax nodes and decorations, relative to the line (blank lines carry none). */
function readings(state: EditorState): string[] {
  const doc = state.doc
  const tree = syntaxTree(state)
  const marks = decorationsOf(state, false).filter(
    (d) => !/^live-(gap|pad)/.test(d.kind) && d.kind !== 'live-endbreak'
  )
  const out: string[] = []
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    if (line.text.trim() === '') continue
    const parts: string[] = []
    const rel = (from: number, to: number): string =>
      `${Math.max(from, line.from) - line.from}-${Math.min(to, line.to) - line.from}${from < line.from ? '<' : ''}${to > line.to ? '>' : ''}`
    tree.iterate({
      from: line.from,
      to: line.to,
      enter: (node) => {
        if (node.to <= line.from || node.from >= line.to) return
        if (node.name !== 'Document' && node.name !== 'Paragraph')
          parts.push(`${node.name}@${rel(node.from, node.to)}`)
      }
    })
    for (const d of marks) {
      const touches = d.from === d.to ? d.from === line.from : d.to > line.from && d.from < line.to
      if (touches) parts.push(`${d.kind}@${rel(d.from, d.to)}`)
    }
    out.push(parts.join(' '))
  }
  return out
}

/** The first non-blank line (1-based, among the non-blank lines) where the editor reads the two texts differently, or null. */
export function firstReadingDifference(before: string, after: string): number | null {
  const a = readings(stateFor(lf(before)))
  const b = readings(stateFor(lf(after)))
  if (a.length !== b.length) return 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i + 1
  return null
}

export interface ParagraphPlan {
  /** Single blanks whose removal (together with the others in this list) leaves the note reading the same. */
  remove: SingleBlank[]
  /** Single blanks that would make the editor read the note differently (a paragraph joining a list item, a line becoming a table row, a hard break, a setext underline, emphasis across the lines …). */
  keep: SingleBlank[]
}

/**
 * Which single blanks of a body to remove, whatever sits on either side (the user's call, 17 Oct 2026: all of them, so the notes are
 * consistent). Each is tried on its own; those that pass are then added one at a time and kept only while the whole set still
 * reads the same, so `*a` / `b` / `c*` loses its first blank line and keeps the second.
 */
export function planParagraphBlanks(body: string): ParagraphPlan {
  const remove: SingleBlank[] = []
  const keep: SingleBlank[] = []
  for (const c of singleBlanks(body)) {
    const tried = [...remove, c].map((b) => b.line)
    const alone = firstReadingDifference(body, dropLines(body, [c.line])) === null
    ;(alone && firstReadingDifference(body, dropLines(body, tried)) === null ? remove : keep).push(
      c
    )
  }
  return { remove, keep }
}
