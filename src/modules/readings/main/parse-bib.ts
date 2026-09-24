import { parse } from '@retorquere/bibtex-parser'
import type { SyncedFields } from '../shared/types'
import { toCreatorList, toKeywords, toText, toYear } from './bib-values'
import { formatShortCitation } from './citation'
import { mapKeywords } from './keywords'
import { buildReferenceDetails } from './reference-details'

export class BibParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BibParseError'
  }
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

  // A second pass with the parser's default sentence casing: Better BibTeX's {braces} mark words that keep their capital.
  const sentenceByKey = new Map(parse(text).entries.map((entry) => [entry.key, entry.fields]))

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
      entryType: entry.type,
      reference: buildReferenceDetails(entry.type, fields, sentenceByKey.get(entry.key) ?? fields)
    })
  }
  return readings
}
