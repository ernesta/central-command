import { parseHeading, scan, scanLines } from './sections'

export interface Topic {
  /** The heading text. */
  text: string
  /** Offset of the heading line in the body, so the page can jump to it. */
  offset: number
  /** Whether the heading is in the meeting's `discussed` list. */
  discussed: boolean
}

const STRUCTURAL = new Set(['summary', 'previous todos', 'notes'])

/**
 * The topics of a meeting note: the level-3 headings under `## Notes`. A note with none (imported
 * notes sometimes have their topics as level-2 headings) uses its level-2 headings other than
 * Summary, Previous TODOs and Notes. Bold pseudo-headings are not topics. Headings inside code
 * fences are ignored. `discussed` holds the heading texts ticked so far; matching is by exact text,
 * so renaming a heading un-ticks it.
 */
export function parseTopics(body: string, discussed: readonly string[] = []): Topic[] {
  const done = new Set(discussed)
  const level3: Topic[] = []
  const level2: Topic[] = []
  let inNotes = false
  for (const l of scanLines(body)) {
    if (l.inFence) continue
    const h = parseHeading(l.text)
    if (!h) continue
    if (h.level <= 2) inNotes = h.level === 2 && h.text.toLowerCase() === 'notes'
    if (h.text === '') continue
    if (h.level === 3 && inNotes)
      level3.push({ text: h.text, offset: l.start, discussed: done.has(h.text) })
    else if (h.level === 2 && !STRUCTURAL.has(h.text.toLowerCase())) {
      level2.push({ text: h.text, offset: l.start, discussed: done.has(h.text) })
    }
  }
  return level3.length > 0 ? level3 : level2
}

/** A heading line's text: one line, no leading hashes. */
function cleanTitle(title: string): string {
  return title
    .trim()
    .replace(/[\r\n]+/g, ' ')
    .replace(/^#+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Add a `### title` topic at the end of the Notes section (creating `## Notes` at the end of the note
 * if there is none). Only inserts: every existing character stays where it was, and nothing is put
 * inside a code fence that is never closed. An empty title changes nothing.
 */
export function appendTopic(body: string, title: string): string {
  const text = cleanTitle(title)
  if (text === '') return body
  const eol = body.includes('\r\n') ? '\r\n' : '\n'
  const { lines, unclosedFenceAt } = scan(body)
  const limit = unclosedFenceAt ?? lines.length
  const lineEnd = (i: number): number => (i + 1 < lines.length ? lines[i + 1].start : body.length)

  const headings = lines.flatMap((l, i) => {
    const h = l.inFence ? null : parseHeading(l.text)
    return h ? [{ ...h, i }] : []
  })
  const notes = headings.find(
    (h) => h.level === 2 && h.text.toLowerCase() === 'notes' && h.i < limit
  )
  const heading = `### ${text}`

  if (notes) {
    const next = headings.find((h) => h.i > notes.i && h.level <= 2)
    const stop = Math.min(next ? next.i : lines.length, limit)
    let last = notes.i
    for (let i = notes.i + 1; i < stop; i++) if (lines[i].text.trim() !== '') last = i
    const pos = lineEnd(last)
    const lead = pos === body.length && !body.endsWith('\n') ? eol : ''
    return body.slice(0, pos) + lead + eol + heading + eol + body.slice(pos)
  }

  const section = `## Notes${eol}${eol}${heading}${eol}`
  if (unclosedFenceAt !== null) {
    const pos = lines[unclosedFenceAt].start
    const before = body.slice(0, pos)
    const gap = before === '' || /\n[ \t]*\r?\n$/.test(before) ? '' : eol
    return before + gap + section + eol + body.slice(pos)
  }
  const endsBlank = /\n[ \t]*\r?\n$/.test(body)
  const sep = body === '' || endsBlank ? '' : body.endsWith('\n') ? eol : eol + eol
  return body + sep + section
}
