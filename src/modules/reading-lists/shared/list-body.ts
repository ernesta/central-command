import { parseHeading, scanLines } from '@shared/sections'

/**
 * One paper in a list. A bullet's leading bold run is its citation: `**@citekey**` names an existing
 * reading (`linked`); any other bold text is a citation typed by hand, kept as plain text until it is
 * attached to a real reading once the Zotero export has it (`placeholder`). A bullet with no leading
 * bold run has no citation yet (`missing`) so it is never silently dropped.
 *
 * `@citekey`, not `[[citekey]]`: Milkdown's Markdown serialiser escapes a literal `[` (`\[\[citekey]]`)
 * wherever it appears, including inside a bold run, so the very next edit that touches the document
 * would rewrite the file and quietly turn every linked entry back into an unrecognised one. `@` has no
 * meaning in CommonMark and round-trips untouched (checked against a real Milkdown editor, not just
 * this parser, since only that showed the escaping).
 */
export type ListEntry =
  | { kind: 'linked'; citekey: string; annotation: string; offset: number }
  | { kind: 'placeholder'; citation: string; annotation: string; offset: number }
  | { kind: 'missing'; annotation: string; offset: number }

export interface ListSection {
  /** The section's own heading text, written as a question in the brief this follows. */
  heading: string
  entries: ListEntry[]
}

const BULLET = /^ {0,3}[-*+][ \t]+(.*)$/
const BOLD_LEAD = /^\*\*(.+?)\*\*[ \t]*(.*)$/
const LINKED_CITEKEY = /^@(\S+)$/

function parseEntryText(text: string, offset: number): ListEntry {
  const bold = BOLD_LEAD.exec(text.trim())
  if (!bold) return { kind: 'missing', annotation: text.trim(), offset }
  const linked = LINKED_CITEKEY.exec(bold[1].trim())
  const annotation = bold[2].trim()
  return linked
    ? { kind: 'linked', citekey: linked[1].trim(), annotation, offset }
    : { kind: 'placeholder', citation: bold[1].trim(), annotation, offset }
}

/**
 * A reading list's sections (`##` headings) and their entries (top-level bullets under a section).
 * Headings inside a code fence are ignored, as elsewhere in the app. A bullet before any heading is
 * dropped (a list starts with a section); a heading of another level does not start a new section, so
 * a `###` under one is just decoration.
 */
export function parseListBody(body: string): ListSection[] {
  const sections: ListSection[] = []
  let current: ListSection | null = null
  for (const l of scanLines(body)) {
    if (l.inFence) continue
    const heading = parseHeading(l.text)
    if (heading) {
      if (heading.level === 2) {
        current = { heading: heading.text, entries: [] }
        sections.push(current)
      }
      continue
    }
    const bullet = BULLET.exec(l.text)
    if (bullet && current) current.entries.push(parseEntryText(bullet[1], l.start))
  }
  return sections
}

/**
 * Rewrites the bullet starting at `lineStart` (an entry's `offset`) so its citation is `**@citekey**`,
 * keeping the rest of the line (the annotation) exactly as it was. Used to attach a placeholder, or one
 * with no citation yet, to a reading once it is found; does nothing if `lineStart` is not really a
 * bullet line (the body changed under the caller).
 */
export function attachReading(body: string, lineStart: number, citekey: string): string {
  const nl = body.indexOf('\n', lineStart)
  const lineEnd = nl === -1 ? body.length : nl
  const line = body.slice(lineStart, lineEnd)
  const bullet = BULLET.exec(line)
  if (!bullet) return body
  const prefix = line.slice(0, line.length - bullet[1].length)
  const { annotation } = parseEntryText(bullet[1], lineStart)
  const newLine = `${prefix}**@${citekey}**${annotation ? ` ${annotation}` : ''}`
  return body.slice(0, lineStart) + newLine + body.slice(lineEnd)
}
