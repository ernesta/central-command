import { parseEntityHref } from '@shared/entities'
import { parseHeading, scanLines } from '@shared/sections'

/**
 * One paper in a list. A bullet's leading bold run is its citation. When it starts with a reading entity
 * (`**[Kim et al. (2020)](cc://reading/<citekey>)**`) the entry is `linked` to that reading. The old
 * `**@citekey**` form is still read as linked until `npm run tidy:reading-lists` rewrites it. Any other bold
 * text is a citation typed by hand for a paper that is not in Zotero yet (`placeholder`); it becomes a link
 * when the reading exists and the tidy script is re-run. A bullet with no leading bold run has no citation yet
 * (`missing`) so it is never silently dropped.
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

export const BULLET = /^ {0,3}[-*+][ \t]+(.*)$/
export const BOLD_LEAD = /^\*\*(.+?)\*\*[ \t]*(.*)$/
const LINKED_CITEKEY = /^@(\S+)$/
const LINKED_ENTITY = /^\[(?:\\.|[^\]\\\n])*\]\((cc:\/\/reading\/[^\s()]+)\)/

/** The citekey a bold run names: a leading reading entity, or the old `@citekey`; null for a typed citation. */
function citekeyOf(bold: string): string | null {
  const entity = LINKED_ENTITY.exec(bold)
  const ref = entity ? parseEntityHref(entity[1]) : null
  if (ref) return ref.key
  return LINKED_CITEKEY.exec(bold)?.[1] ?? null
}

function parseEntryText(text: string, offset: number): ListEntry {
  const bold = BOLD_LEAD.exec(text.trim())
  if (!bold) {
    // A reading mention typed with `@` has no bold around it; it is the citation all the same.
    const mention = LINKED_ENTITY.exec(text.trim())
    const ref = mention ? parseEntityHref(mention[1]) : null
    return ref
      ? {
          kind: 'linked',
          citekey: ref.key,
          annotation: text.trim().slice(mention![0].length).trim(),
          offset
        }
      : { kind: 'missing', annotation: text.trim(), offset }
  }
  const citekey = citekeyOf(bold[1].trim())
  const annotation = bold[2].trim()
  return citekey
    ? { kind: 'linked', citekey, annotation, offset }
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
