import { entityHref, escapeLabel } from './entities'

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

/** Ranges that must never be touched: front matter, fenced and inline code, existing links, URLs, headings. */
function protectedRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  const front = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(text)
  if (front) ranges.push([0, front[0].length])
  let offset = 0
  let fenced = false
  for (const line of text.split('\n')) {
    const end = offset + line.length
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced
      ranges.push([offset, end])
    } else if (fenced || /^\s{0,3}#{1,6}\s/.test(line)) ranges.push([offset, end])
    offset = end + 1
  }
  for (const re of [/`[^`\n]*`/g, /\[[^\]\n]*\]\([^)\n]*\)/g, /<?https?:\/\/[^\s)>]+>?/g]) {
    for (const m of text.matchAll(re)) ranges.push([m.index, m.index + m[0].length])
  }
  return ranges
}

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
