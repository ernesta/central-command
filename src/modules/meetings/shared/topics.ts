import { parseHeading, scanLines } from './sections'

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
