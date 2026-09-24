import type { Author, ReferenceDetails } from './types'

/** What the formatter needs from a reading. */
export interface ApaInput {
  authors: Author[]
  year: number | null
  fullTitle: string
  entryType: string
  reference: ReferenceDetails | null
}

export interface ApaReference {
  /** With italics as <i>…</i>, ready to paste into Word or Google Docs. */
  html: string
  /** Plain text: the same reference without formatting. */
  text: string
}

/** A run of text, italic or not. Building references from these keeps the text and HTML forms in step. */
type Segment = { t: string; i?: boolean }

const plain = (t: string): Segment => ({ t })
const italic = (t: string): Segment => ({ t, i: true })

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function render(segments: Segment[]): ApaReference {
  const merged = segments.filter((s) => s.t !== '')
  return {
    text: merged.map((s) => s.t).join(''),
    html: merged.map((s) => (s.i ? `<i>${escapeHtml(s.t)}</i>` : escapeHtml(s.t))).join('')
  }
}

// ---------------------------------------------------------------- names

/** "Guido W" -> "G. W."; "Jean-Paul" -> "J.-P."; "David M." -> "D. M." */
export function initials(given: string): string {
  return given
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => {
      const parts = word.split('.').filter(Boolean)
      // "J.K." arrives as one word: keep each letter, otherwise treat the word as one name.
      if (word.includes('.') && parts.every((p) => p.length === 1))
        return parts.map((p) => `${p.toUpperCase()}.`)
      return [
        word
          .split('-')
          .filter(Boolean)
          .map((piece) => `${piece.charAt(0).toUpperCase()}.`)
          .join('-')
      ]
    })
    .join(' ')
}

const isPerson = (a: Author): a is { family: string; given?: string } => 'family' in a

/** "Abadie, A." for people, the whole name for institutions. */
function authorName(a: Author): string {
  if (!isPerson(a)) return a.literal
  return a.given ? `${a.family}, ${initials(a.given)}` : a.family
}

/** APA reference-list author list: up to 20 names, with an ampersand; 21+ are abridged. */
function authorList(authors: Author[]): string {
  const names = authors.map(authorName)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length <= 20) return `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`
  return `${names.slice(0, 19).join(', ')}, . . . ${names[names.length - 1]}`
}

/** Editors of a book, as they appear after "In": initials first, "A. Cox & B. Feez (Eds.)". */
function editorList(editors: Author[]): string {
  const names = editors.map((a) =>
    isPerson(a) && a.given ? `${initials(a.given)} ${a.family}` : isPerson(a) ? a.family : a.literal
  )
  const joined =
    names.length <= 2
      ? names.join(' & ')
      : `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`
  return `${joined} (${names.length === 1 ? 'Ed.' : 'Eds.'})`
}

// ---------------------------------------------------------------- pieces

/** Append a full stop unless the text already ends in sentence punctuation. */
const stop = (text: string): string =>
  /[.?!]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

/** "(2023)" for most sources; "(2025, June 12)" for web pages with a full date. */
function dateLabel(input: ApaInput, withFullDate: boolean): string {
  const year = input.year === null ? 'n.d.' : String(input.year)
  const match = input.reference?.date?.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/)
  if (withFullDate && match && input.year !== null) {
    const month = MONTHS[Number(match[2]) - 1]
    if (month) return `${year}, ${month}${match[3] ? ` ${Number(match[3])}` : ''}`
  }
  return year
}

/** Page ranges use an en dash: "49-67" and "49--67" both become "49–67". */
const pageRange = (pages: string): string => pages.replace(/\s*(?:--|—|-)\s*/g, '–')

function doiOrUrl(ref: ReferenceDetails): string {
  if (ref.doi) {
    const bare = ref.doi.replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, '')
    return `https://doi.org/${bare}`
  }
  return ref.url ?? ''
}

function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13
  const suffix = teen
    ? 'th'
    : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th')
  return `${n}${suffix}`
}

/** "2" -> "(2nd ed.)"; "Second" -> "(Second ed.)". First editions are not marked. */
function editionLabel(edition: string | undefined): string {
  if (!edition) return ''
  const n = /^\d+$/.test(edition.trim()) ? Number(edition) : null
  if (n === 1) return ''
  return ` (${n ? ordinal(n) : edition.replace(/\.?$/, '')} ed.)`
}

/** Where a work came from: the publisher, unless it is just the author again (APA drops it). */
function publisherText(ref: ReferenceDetails, authors: Author[]): string {
  const publisher = ref.publisher?.trim()
  if (!publisher) return ''
  const sameAsAuthor = authors.some(
    (a) => !isPerson(a) && a.literal.toLowerCase() === publisher.toLowerCase()
  )
  return sameAsAuthor ? '' : stop(publisher)
}

function thesisLabel(ref: ReferenceDetails): string {
  const kind = ref.genre?.toLowerCase() ?? ''
  const label = /ph\.?d|doctor/.test(kind)
    ? 'Doctoral dissertation'
    : /master/.test(kind)
      ? 'Master’s thesis'
      : ref.genre || 'Thesis'
  return ref.institution ? `${label}, ${ref.institution}` : label
}

/** "(Vol. 3, pp. 49–67)" style part after a book or proceedings title. */
function volumePages(ref: ReferenceDetails): string {
  const parts = [
    ref.volume ? `Vol. ${ref.volume}` : '',
    ref.pages ? `pp. ${pageRange(ref.pages)}` : ''
  ].filter(Boolean)
  return parts.length ? ` (${parts.join(', ')})` : ''
}

// ---------------------------------------------------------------- main

/**
 * A reference in APA 7th edition style. Covers the entry types a Zotero library normally holds
 * (journal articles, books, chapters, reports, theses, conference papers, datasets, software,
 * web pages) and falls back to a general "Author (Year). Title. Publisher. URL" for the rest.
 * The user can still edit the result after pasting; this gets the structure and punctuation right.
 */
export function formatApa(input: ApaInput): ApaReference {
  const ref: ReferenceDetails = input.reference ?? { titleSentence: input.fullTitle }
  const title = ref.titleSentence || input.fullTitle
  const type = input.entryType
  const editors = ref.editors ?? []

  // Who is credited: authors; failing that the editors ("(Eds.)"); failing that the title leads.
  const byAuthors = input.authors.length > 0
  const byEditors = !byAuthors && editors.length > 0
  const creditText = byAuthors ? authorList(input.authors) : byEditors ? authorList(editors) : ''
  const editorSuffix = byEditors ? ` (${editors.length === 1 ? 'Ed.' : 'Eds.'})` : ''
  const creditors = byAuthors ? input.authors : editors

  const parts: Segment[] = []
  const add = (...segs: Segment[]): void => void parts.push(...segs)
  const link = doiOrUrl(ref)
  const dated = (full = false): string => `(${dateLabel(input, full)})`

  /** Author block plus date: "Abadie, A. (2023). " or, with no author, just the date after the title. */
  const lead = (full = false): void => {
    if (creditText) add(plain(`${stop(creditText + editorSuffix)} ${dated(full)}. `))
  }
  const noCredit = (): boolean => creditText === ''
  const trailingDate = (full = false): void => {
    if (noCredit()) add(plain(` ${dated(full)}.`))
  }

  const tail = (): void => {
    const publisher = publisherText(ref, creditors)
    if (publisher) add(plain(` ${publisher}`))
    if (link) add(plain(` ${link}`))
  }

  switch (type) {
    case 'article': {
      if (!ref.container) return fallback()
      lead()
      add(plain(stop(title)))
      trailingDate()
      const volume = ref.volume ? `${ref.container}, ${ref.volume}` : ref.container
      add(plain(' '), italic(volume))
      if (ref.issue) add(plain(`(${ref.issue})`))
      const locator = ref.pages
        ? pageRange(ref.pages)
        : ref.articleNumber
          ? `Article ${ref.articleNumber}`
          : ''
      add(plain(locator ? `, ${locator}.` : '.'))
      if (link) add(plain(` ${link}`))
      break
    }
    case 'incollection':
    case 'inbook': {
      lead()
      add(plain(stop(title)))
      trailingDate()
      const book = ref.containerSentence ?? ref.container
      add(plain(' In '))
      if (editors.length > 0) add(plain(`${editorList(editors)}, `))
      if (book) add(italic(book))
      add(plain(`${volumePages(ref)}.`))
      tail()
      break
    }
    case 'inproceedings': {
      lead()
      add(plain(stop(title)))
      trailingDate()
      add(plain(' In '))
      if (editors.length > 0) add(plain(`${editorList(editors)}, `))
      if (ref.container) add(italic(ref.container))
      add(plain(`${volumePages(ref)}.`))
      tail()
      break
    }
    case 'book':
    case 'collection':
    case 'proceedings': {
      if (noCredit()) {
        add(italic(title), plain(`${editionLabel(ref.edition)}.`))
        trailingDate()
      } else {
        lead()
        add(italic(title), plain(`${editionLabel(ref.edition)}.`))
      }
      tail()
      break
    }
    case 'report':
    case 'techreport': {
      const kind = ref.genre ? ref.genre : 'Report'
      const numbered = ref.reportNumber
        ? ` (${kind} No. ${ref.reportNumber})`
        : ref.genre
          ? ` [${ref.genre}]`
          : ''
      lead()
      add(italic(title), plain(`${numbered}.`))
      trailingDate()
      tail()
      break
    }
    case 'thesis':
    case 'phdthesis':
    case 'mastersthesis': {
      lead()
      add(italic(title), plain(` [${thesisLabel(ref)}].`))
      trailingDate()
      if (link) add(plain(` ${link}`))
      break
    }
    case 'dataset':
    case 'software': {
      const version = ref.version ? ` (Version ${ref.version.replace(/^v/i, '')})` : ''
      const kind = type === 'dataset' ? 'Data set' : 'Computer software'
      lead()
      add(italic(title), plain(`${version} [${kind}].`))
      trailingDate()
      tail()
      break
    }
    default:
      return fallback()
  }
  return render(finish(parts))

  /** Web pages, preprints and anything unrecognised: Author (Date). *Title*. Site. URL */
  function fallback(): ApaReference {
    parts.length = 0
    const web = type === 'online' || type === 'webpage' || type === 'www'
    lead(web)
    add(italic(title), plain('.'))
    trailingDate(web)
    tail()
    return render(finish(parts))
  }
}

/** Tidy the seams between pieces: no doubled spaces, no stray space before punctuation. */
function finish(parts: Segment[]): Segment[] {
  const out = parts.map((s) => ({ ...s }))
  for (let n = 0; n < out.length; n++) {
    out[n].t = out[n].t.replace(/ {2,}/g, ' ')
    if (n > 0 && out[n - 1].t.endsWith(' ') && out[n].t.startsWith(' '))
      out[n].t = out[n].t.slice(1)
  }
  if (out.length > 0) out[out.length - 1].t = out[out.length - 1].t.trimEnd()
  if (out.length > 0) out[0].t = out[0].t.trimStart()
  return out
}
