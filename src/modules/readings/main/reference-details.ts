import type { ReferenceDetails } from '../shared/types'
import { toCreatorList, toText } from './bib-values'

type Fields = Record<string, unknown>

/** A field's text. List-valued fields (publisher, location, institution) are joined with "; ". */
const fieldText = (value: unknown): string =>
  Array.isArray(value)
    ? value
        .map((item) => toText(item))
        .filter(Boolean)
        .join('; ')
    : toText(value)

const first = (fields: Fields, ...names: string[]): string | undefined => {
  for (const name of names) {
    const value = fieldText(fields[name])
    if (value) return value
  }
  return undefined
}

/**
 * The bibliographic details needed to format a reference, from one entry's fields.
 * `asStored` holds titles exactly as Zotero has them; `sentence` holds the same entry parsed
 * with sentence casing, which uses Better BibTeX's case-protection braces to keep proper nouns.
 * Empty values are omitted so the JSON stays small.
 */
export function buildReferenceDetails(
  type: string,
  asStored: Fields,
  sentence: Fields
): ReferenceDetails {
  const isArticle = type === 'article'
  const number = first(asStored, 'number')
  const institution = first(asStored, 'institution', 'school', 'organization')
  const editors = toCreatorList(asStored.editor).authors

  const details: ReferenceDetails = {
    titleSentence: toText(sentence.title) || toText(asStored.title),
    container: first(asStored, 'journaltitle', 'journal', 'booktitle', 'maintitle'),
    containerSentence: first(sentence, 'booktitle', 'maintitle'),
    volume: first(asStored, 'volume'),
    issue: isArticle ? (number ?? first(asStored, 'issue')) : first(asStored, 'issue'),
    pages: first(asStored, 'pages'),
    articleNumber: first(asStored, 'eid', 'articleno'),
    publisher: first(asStored, 'publisher') ?? (type === 'report' ? institution : undefined),
    place: first(asStored, 'location', 'address'),
    edition: first(asStored, 'edition'),
    doi: first(asStored, 'doi'),
    url: first(asStored, 'url'),
    editors: editors.length > 0 ? editors : undefined,
    reportNumber: isArticle ? undefined : number,
    genre: first(asStored, 'type'),
    institution,
    version: first(asStored, 'version'),
    date: first(asStored, 'date', 'year'),
    preprint: toText(asStored.pubstate).toLowerCase() === 'prepublished' ? true : undefined
  }
  // Drop undefined keys so the stored JSON is compact and comparisons are stable.
  return JSON.parse(JSON.stringify(details)) as ReferenceDetails
}
