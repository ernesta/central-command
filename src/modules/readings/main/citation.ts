import type { Author } from '../shared/types'

interface CitationInput {
  authors: Author[]
  editors?: Author[]
  year: number | null
  title: string
  /** The source listed "and others": treat as having more authors than are named. */
  etAl?: boolean
}

const TITLE_WORDS = 4

function surname(author: Author): string {
  return 'literal' in author ? author.literal : author.family
}

function names(people: Author[], etAl: boolean): string {
  const [first, second] = people
  if (people.length === 1 && !etAl) return surname(first)
  if (people.length === 2 && !etAl) return `${surname(first)} & ${surname(second)}`
  return `${surname(first)} et al.`
}

function titleLead(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'Untitled'
  const lead = words
    .slice(0, TITLE_WORDS)
    .join(' ')
    .replace(/[\s:;,.\-–—]+$/, '')
  return words.length > TITLE_WORDS ? `${lead}…` : lead
}

/**
 * APA in-text style: `Surname (Year)`, `A & B (Year)`, `A et al. (Year)`.
 * Institutions are used whole. With no authors, editors are used; with neither,
 * the first few words of the title. A missing year becomes `(n.d.)`.
 */
export function formatShortCitation(input: CitationInput): string {
  const year = input.year === null ? 'n.d.' : String(input.year)
  const people = input.authors.length > 0 ? input.authors : (input.editors ?? [])
  const lead =
    people.length > 0
      ? names(people, input.authors.length > 0 && input.etAl === true)
      : titleLead(input.title)
  return `${lead} (${year})`
}
