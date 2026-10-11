import { entityHref, escapeLabel } from './entities'
import { protectedRanges } from './note-text'

/**
 * Plain-text citations ("Kim et al. (2020)", "(Castles & Coltheart, 2004)") to reading entities (notes feedback round,
 * stage 3). A citation is only linked when exactly one reading fits its authors, their number and the year; anything
 * less certain is reported, never guessed.
 */

export interface CitableReading {
  citekey: string
  /** Family names in order; a corporate author is its literal name. */
  authors: string[]
  year: number | null
}

export interface Citation {
  /** The text that becomes the label, from the first surname to the year. */
  start: number
  end: number
  text: string
  /** Surnames as written, and whether "et al." followed them. */
  names: string[]
  etAl: boolean
  year: number
  suffix: string
}

export type Resolution =
  | { kind: 'linked'; citekey: string }
  | { kind: 'ambiguous'; citekeys: string[] }
  | { kind: 'loose'; citekeys: string[] }
  | { kind: 'none' }

export interface Proposal {
  citation: Citation
  resolution: Resolution
}

const PARTICLE = '(?:(?:de|De|von|Von|van|Van|der|Der|den|di|Di|du|Du|le|Le|la|La|el|El)\\s)?'
const NAME = `${PARTICLE}[A-ZÀ-ÖØ-Þ][\\p{L}'’‐\\-]*\\p{L}`
const YEAR = '((?:19|20)\\d\\d)([a-z])?'
const CITATION = new RegExp(
  `(?<![\\p{L}\\p{N}'’-])(${NAME}(?:,\\s+${NAME})*(?:,?\\s+(?:and|&)\\s+${NAME}|\\s+et\\s+al\\.?)?)` +
    `(?:\\s+\\(${YEAR}\\)|,\\s+\\(?${YEAR}(?![\\p{L}\\d]|[–-]\\d))`,
  'gu'
)

const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[‐–‑]/g, '-')
    .replace(/’/g, "'")
    .toLowerCase()
    .trim()

/** Compare surnames by their last word, so "von Fintel" and "Fintel" agree. */
const sameName = (a: string, b: string): boolean => {
  const last = (s: string): string => norm(s).split(/\s+/).pop() as string
  return last(a) === last(b)
}

/** Every citation-shaped piece of text, in order, outside protected ranges. */
export function findCitations(text: string): Citation[] {
  const skip = protectedRanges(text)
  const found: Citation[] = []
  for (const m of text.matchAll(CITATION)) {
    const start = m.index
    const stop = start + m[0].length
    if (skip.some(([a, b]) => start < b && stop > a)) continue
    const raw = m[1]
    const etAl = /\s+et\s+al\.?$/.test(raw)
    const names = raw
      .replace(/\s+et\s+al\.?$/, '')
      .split(/,?\s+(?:and|&)\s+|,\s+/)
      .map((n) => n.trim())
    const year = Number(m[2] ?? m[4])
    found.push({
      start,
      end: stop,
      text: text.slice(start, stop),
      names,
      etAl,
      year,
      suffix: m[3] ?? m[5] ?? ''
    })
  }
  return found
}

function candidates(c: Citation, readings: CitableReading[], strict: boolean): string[] {
  return readings
    .filter((r) => {
      if (r.year !== c.year || r.authors.length === 0) return false
      if (!sameName(r.authors[0], c.names[0])) return false
      if (!strict) return true
      if (c.etAl) return r.authors.length >= 3 && c.names.length === 1
      if (c.names.length !== r.authors.length) return false
      return c.names.every((n, i) => sameName(r.authors[i], n))
    })
    .map((r) => r.citekey)
}

/** What a citation points to. Leading words that are not surnames ("Pedagogical, Koda and Reddy") are tried off. */
export function resolveCitation(
  c: Citation,
  readings: CitableReading[]
): { resolution: Resolution; citation: Citation } {
  for (let k = 0; k < c.names.length; k++) {
    const sub: Citation = { ...c, names: c.names.slice(k) }
    const strict = candidates(sub, readings, true)
    if (strict.length === 1) {
      // Move the label's start past the names that were dropped.
      let start = c.start
      if (k > 0) {
        const at = c.text.indexOf(c.names[k])
        start = c.start + Math.max(at, 0)
      }
      return {
        resolution: { kind: 'linked', citekey: strict[0] },
        citation: { ...sub, start, text: c.text.slice(start - c.start) }
      }
    }
    if (strict.length > 1)
      return { resolution: { kind: 'ambiguous', citekeys: strict }, citation: c }
  }
  const loose = candidates(c, readings, false)
  return {
    resolution: loose.length ? { kind: 'loose', citekeys: loose } : { kind: 'none' },
    citation: c
  }
}

/** Works referred to by their title rather than by authors and year; each is linked when its reading exists. */
export const NAMED_WORKS: ReadonlyArray<{ pattern: RegExp; citekey: string }> = [
  { pattern: /loud and clear/gi, citekey: 'worldbankLoudClearEffective2021' }
]

function namedMentions(text: string, readings: CitableReading[]): Proposal[] {
  const skip = protectedRanges(text)
  const found: Proposal[] = []
  for (const { pattern, citekey } of NAMED_WORKS) {
    if (!readings.some((r) => r.citekey === citekey)) continue
    for (const m of text.matchAll(pattern)) {
      const start = m.index
      const end = start + m[0].length
      if (skip.some(([a, b]) => start < b && end > a)) continue
      found.push({
        citation: { start, end, text: m[0], names: [], etAl: false, year: 0, suffix: '' },
        resolution: { kind: 'linked', citekey }
      })
    }
  }
  return found
}

export function proposeCitations(text: string, readings: CitableReading[]): Proposal[] {
  const cited = findCitations(text).map((c) => {
    const { resolution, citation } = resolveCitation(c, readings)
    return { citation, resolution }
  })
  return [...cited, ...namedMentions(text, readings)].sort(
    (a, b) => a.citation.start - b.citation.start
  )
}

/** The text with every linked proposal wrapped as `[label](cc://reading/citekey)`. */
export function applyCitations(text: string, proposals: Proposal[]): string {
  let out = text
  const linked = proposals.filter(
    (p): p is Proposal & { resolution: { kind: 'linked'; citekey: string } } =>
      p.resolution.kind === 'linked'
  )
  for (const p of linked.reverse()) {
    const { start, end, text: label } = p.citation
    out =
      out.slice(0, start) +
      `[${escapeLabel(label)}](${entityHref({ kind: 'reading', key: p.resolution.citekey })})` +
      out.slice(end)
  }
  return out
}

/**
 * Citekey markers: the Pandoc/Obsidian shorthand `[@Harm2004]` that came in with the imported notes. The plain-text
 * pass above never sees them (they are not "Author (Year)"), so they stayed as text. A marker names its first author's
 * surname and the year, which is enough to find the reading but not enough to write the label, so the label is built
 * from the reading's own authors in the style the rest of the library uses: "Harm & Seidenberg (2004)" when the marker
 * is read as part of the sentence, "Harm & Seidenberg, 2004" when it sits in brackets as a reference.
 */

export interface CitekeyMarker {
  /** The whole `[@Harm2004]`. */
  start: number
  end: number
  text: string
  /** The surname and year as written, and a year suffix ("2019a") when there is one. */
  name: string
  year: number
  suffix: string
  /**
   * True when the marker is a reference inside brackets ("(e.g., following [@Pretorius2019])") rather than a name the
   * sentence reads out ("(like the languages [@Pretorius2019] discusses)"): it closes the brackets it sits in.
   */
  parenthetical: boolean
}

export interface CitekeyProposal {
  marker: CitekeyMarker
  resolution: Resolution
  /** What the marker becomes when it is linked; '' when it is not. */
  label: string
}

const CITEKEY_MARKER = new RegExp(
  `\\[@(${PARTICLE}[\\p{L}][\\p{L}'’\\-]*)((?:19|20)\\d\\d)([a-z])?\\]`,
  'gu'
)
/** Anything else marker-shaped, so a form this does not understand is reported instead of passed over. */
const CITEKEY_SHAPED = /\[@[^\]\n]*\]/g

/** Brackets that are the writer's own: inline links and inline code are taken out before they are counted. */
function openBrackets(line: string): number {
  const bare = line.replace(/\[[^\]\n]*\]\([^)\n]*\)/g, '').replace(/`[^`\n]*`/g, '')
  let depth = 0
  for (const c of bare) {
    if (c === '(') depth++
    else if (c === ')' && depth > 0) depth--
  }
  return depth
}

/** Every citekey marker, in order, outside protected ranges. */
export function findCitekeyMarkers(text: string): CitekeyMarker[] {
  const skip = protectedRanges(text)
  const found: CitekeyMarker[] = []
  for (const m of text.matchAll(CITEKEY_MARKER)) {
    const start = m.index
    const end = start + m[0].length
    if (skip.some(([a, b]) => start < b && end > a)) continue
    const lineStart = text.lastIndexOf('\n', start - 1) + 1
    const after = text.slice(end).replace(/^[ \t]+/, '')
    found.push({
      start,
      end,
      text: m[0],
      name: m[1],
      year: Number(m[2]),
      suffix: m[3] ?? '',
      parenthetical: after.startsWith(')') && openBrackets(text.slice(lineStart, start)) > 0
    })
  }
  return found
}

/** Marker-shaped text this does not understand, as written. */
export function unreadableCitekeys(text: string): Array<{ start: number; text: string }> {
  const known = new Set(findCitekeyMarkers(text).map((m) => m.text))
  const skip = protectedRanges(text)
  return [...text.matchAll(CITEKEY_SHAPED)]
    .filter(
      (m) =>
        !known.has(m[0]) &&
        !skip.some(([a, b]) => (m.index as number) < b && (m.index as number) + m[0].length > a)
    )
    .map((m) => ({ start: m.index, text: m[0] }))
}

/** Surnames the way the library writes them: "Pretorius", "Harm & Seidenberg", "Chang et al.". */
export function apaNames(authors: string[]): string {
  if (authors.length === 0) return ''
  if (authors.length === 1) return authors[0]
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`
  return `${authors[0]} et al.`
}

/** The label a marker becomes: a name the sentence reads out, or a reference in brackets. */
export function citekeyLabel(marker: CitekeyMarker, reading: CitableReading): string {
  const year = `${marker.year}${marker.suffix}`
  const names = apaNames(reading.authors)
  if (!names) return year
  return marker.parenthetical ? `${names}, ${year}` : `${names} (${year})`
}

/** The reading a marker names: the year and the first author's surname, and only when exactly one reading fits. */
export function resolveCitekeyMarker(
  marker: CitekeyMarker,
  readings: CitableReading[]
): Resolution {
  const fits = readings.filter(
    (r) => r.year === marker.year && r.authors.length > 0 && sameName(r.authors[0], marker.name)
  )
  if (fits.length === 1) return { kind: 'linked', citekey: fits[0].citekey }
  if (fits.length > 1) return { kind: 'ambiguous', citekeys: fits.map((r) => r.citekey) }
  return { kind: 'none' }
}

export function proposeCitekeys(text: string, readings: CitableReading[]): CitekeyProposal[] {
  return findCitekeyMarkers(text).map((marker) => {
    const resolution = resolveCitekeyMarker(marker, readings)
    const reading =
      resolution.kind === 'linked'
        ? readings.find((r) => r.citekey === resolution.citekey)
        : undefined
    return { marker, resolution, label: reading ? citekeyLabel(marker, reading) : '' }
  })
}

/** The text with every linked marker replaced by `[label](cc://reading/citekey)`. */
export function applyCitekeys(text: string, proposals: CitekeyProposal[]): string {
  let out = text
  const linked = proposals.filter((p) => p.resolution.kind === 'linked')
  for (const p of [...linked].reverse()) {
    const citekey = (p.resolution as { citekey: string }).citekey
    out =
      out.slice(0, p.marker.start) +
      `[${escapeLabel(p.label)}](${entityHref({ kind: 'reading', key: citekey })})` +
      out.slice(p.marker.end)
  }
  return out
}

/**
 * The rewrite undone: every new link back to the marker it came from. The caller checks this gives back the original
 * text exactly, so a rewrite that touched anything else is left alone rather than written.
 */
export function undoCitekeys(next: string, proposals: CitekeyProposal[]): string {
  let out = next
  const linked = proposals.filter((p) => p.resolution.kind === 'linked')
  let at = 0
  for (const p of linked) {
    const citekey = (p.resolution as { citekey: string }).citekey
    const link = `[${escapeLabel(p.label)}](${entityHref({ kind: 'reading', key: citekey })})`
    const found = out.indexOf(link, at)
    if (found < 0) return next
    out = out.slice(0, found) + p.marker.text + out.slice(found + link.length)
    at = found + p.marker.text.length
  }
  return out
}
