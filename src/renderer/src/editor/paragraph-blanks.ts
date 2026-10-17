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

export const isParagraphPair = (b: SingleBlank): boolean =>
  b.above === 'paragraph' && b.below === 'paragraph'

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
  /** Single blanks between two paragraph lines whose removal leaves the note reading the same. */
  remove: SingleBlank[]
  /** Paragraph pairs that read differently once joined (hard breaks, emphasis across the lines, setext underlines …). */
  keep: SingleBlank[]
  /** Every other single blank line, for the dry run to list by kind. */
  others: SingleBlank[]
  /** True when removing all of `remove` together does not read the same (then nothing is removed from this note). */
  combinedDiffers: boolean
}

/** Which single blanks of a body to remove. Each is tried on its own first; the set is then checked together. */
export function planParagraphBlanks(body: string): ParagraphPlan {
  const all = singleBlanks(body)
  const others = all.filter((b) => !isParagraphPair(b))
  const candidates = all.filter(isParagraphPair)
  const remove: SingleBlank[] = []
  const keep: SingleBlank[] = []
  for (const c of candidates)
    (firstReadingDifference(body, dropLines(body, [c.line])) === null ? remove : keep).push(c)
  const combinedDiffers =
    remove.length > 1 &&
    firstReadingDifference(
      body,
      dropLines(
        body,
        remove.map((b) => b.line)
      )
    ) !== null
  return { remove: combinedDiffers ? [] : remove, keep, others, combinedDiffers }
}
