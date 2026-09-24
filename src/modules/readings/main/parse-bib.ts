import { parse } from '@retorquere/bibtex-parser'
import type { Author, SyncedFields } from '../shared/types'
import { formatShortCitation } from './citation'
import { mapKeywords } from './keywords'

export class BibParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BibParseError'
  }
}

interface RawCreator {
  name?: string
  lastName?: string
  firstName?: string
  prefix?: string
}

interface CreatorList {
  authors: Author[]
  /** The source ended the list with "and others". */
  etAl: boolean
}

/** The parser emits decomposed accents (u + combining mark); composed form searches and sorts correctly. */
const nfc = (text: string): string => text.normalize('NFC')

function toCreatorList(raw: unknown): CreatorList {
  const authors: Author[] = []
  let etAl = false
  if (!Array.isArray(raw)) return { authors, etAl }
  for (const creator of raw as RawCreator[]) {
    if (creator.name) {
      authors.push({ literal: nfc(creator.name.trim()) })
    } else if (creator.lastName === 'others' && !creator.firstName) {
      etAl = true
    } else if (creator.lastName) {
      const family = nfc([creator.prefix, creator.lastName].filter(Boolean).join(' ').trim())
      const given = creator.firstName ? nfc(creator.firstName.trim()) : undefined
      authors.push(given ? { family, given } : { family })
    }
  }
  return { authors, etAl }
}

function toYear(...candidates: unknown[]): number | null {
  for (const value of candidates) {
    if (typeof value !== 'string') continue
    const match = value.match(/^\s*(\d{4})/)
    if (match) return Number(match[1])
  }
  return null
}

function toKeywords(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((k) => nfc(String(k)))
  if (typeof value === 'string') return value.split(',').map(nfc)
  return []
}

function toText(value: unknown): string {
  return typeof value === 'string' ? nfc(value.replace(/\s+/g, ' ').trim()) : ''
}

/**
 * Parse a Better BibTeX / Better BibLaTeX export into the fields a sync owns.
 * Throws BibParseError if the file cannot be parsed cleanly or has no entries, so
 * callers can leave existing data untouched. Duplicate citekeys keep the first entry.
 */
export function parseBib(text: string): SyncedFields[] {
  let result: ReturnType<typeof parse>
  try {
    // sentenceCase off: keep titles exactly as Zotero has them.
    result = parse(text, { sentenceCase: false })
  } catch (error) {
    throw new BibParseError(error instanceof Error ? error.message : String(error))
  }
  if (result.errors.length > 0) {
    throw new BibParseError(
      `${result.errors.length} parse error(s); first: ${result.errors[0].error}`
    )
  }
  // An empty or half-written file parses "successfully" with no entries. Treating that as
  // a failure stops a sync from flagging the whole library as missing.
  if (result.entries.length === 0) {
    throw new BibParseError('The export contains no entries.')
  }

  const seen = new Set<string>()
  const readings: SyncedFields[] = []
  for (const entry of result.entries) {
    if (!entry.key || seen.has(entry.key)) continue
    seen.add(entry.key)

    const { fields } = entry
    const { authors, etAl } = toCreatorList(fields.author)
    const { authors: editors } = toCreatorList(fields.editor)
    const year = toYear(fields.year, fields.date)
    const fullTitle = toText(fields.title)
    const { status, tags } = mapKeywords(toKeywords(fields.keywords))
    const abstract = toText(fields.abstract)

    readings.push({
      citekey: entry.key,
      shortCitation: formatShortCitation({ authors, editors, year, title: fullTitle, etAl }),
      fullTitle,
      authors,
      year,
      status,
      tags,
      abstract: abstract || null,
      entryType: entry.type
    })
  }
  return readings
}
