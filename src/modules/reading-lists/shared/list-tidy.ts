import { entityHref, escapeLabel, parseEntityHref } from '@shared/entities'
import { findCitations, resolveCitation, type CitableReading } from '@shared/citations'
import { parseHeading, scanLines } from '@shared/sections'
import { BOLD_LEAD, BULLET } from './list-body'

/**
 * Brings a reading list's entries to the entity format (notes feedback round, stage 4): a linked entry is
 * `- **[label](cc://reading/key)** annotation`, with no repeated title and journal. A bullet whose bold run
 * starts with a reading entity is shortened to that link; `**@key**` becomes an entity; a typed citation
 * stays exactly as written unless exactly one reading fits it, and then it becomes a link (the full
 * reference text is dropped, the reading holds it). The annotation is never touched. Running it again
 * changes nothing that is already tidy.
 */

const LEADING_ENTITY = /^(\[(?:\\.|[^\]\\\n])*\]\((cc:\/\/reading\/[^\s()]+)\))/

export interface TidyLists {
  readings: CitableReading[]
  /** The label for a reading named only by `@citekey`, or '' when it is not known. */
  labelFor: (citekey: string) => string
}

export interface TidyResult {
  body: string
  /** One line per entry that changed, for the dry run. */
  changes: string[]
  /** Typed citations that fit no single reading, for the "still waiting" list. */
  waiting: string[]
}

const link = (label: string, citekey: string): string =>
  `**[${escapeLabel(label)}](${entityHref({ kind: 'reading', key: citekey })})**`

export function tidyListBody(body: string, ctx: TidyLists): TidyResult {
  const changes: string[] = []
  const waiting: string[] = []
  let out = ''
  let cursor = 0
  let inSection = false
  for (const l of scanLines(body)) {
    if (l.inFence) continue
    const heading = parseHeading(l.text)
    if (heading) {
      if (heading.level === 2) inSection = true
      continue
    }
    const bullet = inSection ? BULLET.exec(l.text) : null
    if (!bullet) continue
    const text = bullet[1].trim()
    const prefix = l.text.slice(0, l.text.length - bullet[1].length)
    const lead = BOLD_LEAD.exec(text)
    if (!lead) continue
    const bold = lead[1].trim()
    const rest = text.slice(text.indexOf('**', 2) + 2)
    let replacement: string | null = null
    const entity = LEADING_ENTITY.exec(bold)
    const legacy = /^@(\S+)$/.exec(bold)
    if (entity) {
      if (!parseEntityHref(entity[2])) continue
      if (bold !== entity[1]) replacement = `**${entity[1]}**`
    } else if (legacy) {
      const label = ctx.labelFor(legacy[1])
      if (label) replacement = link(label, legacy[1])
    } else {
      const first = findCitations(bold)[0]
      if (first && first.start === 0) {
        const { resolution, citation } = resolveCitation(first, ctx.readings)
        if (resolution.kind === 'linked') replacement = link(citation.text, resolution.citekey)
        else waiting.push(bold)
      } else waiting.push(bold)
    }
    if (replacement === null) continue
    const line = prefix + replacement + rest
    changes.push(`${l.text.trim().slice(0, 90)}\n      -> ${line.trim().slice(0, 90)}`)
    out += body.slice(cursor, l.start) + line
    cursor = l.start + l.text.length
  }
  return { body: out + body.slice(cursor), changes, waiting }
}
