import { fold } from './text'

/** One result of the global search: where it is, what to call it, and one line about it. */
export interface SearchHit {
  /** Unique within its source. */
  key: string
  title: string
  /** One line: the part of the text that matched, or the details of the item. */
  detail: string
  /** Where clicking the result goes. Leave out for a hit that only ever `run`s. */
  route?: string
  /** Runs instead of navigating (a command: "New meeting" creates one, then goes to it itself). */
  run?: () => void | Promise<void>
}

/** The words of a search, folded (accents and case do not matter); every word has to match. */
export function searchTerms(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean)
}

/**
 * The stretch of `text` around the first search word found in it, cut at word edges with … where text was left
 * out; null when no word is in the text. `text` is plain text (no Markdown marks).
 */
export function snippet(text: string, terms: readonly string[], length = 90): string | null {
  const plain = text.replace(/\s+/g, ' ').trim()
  const folded = fold(plain)
  // Folding can change the length (æ becomes ae); then the positions no longer line up, so give up on a snippet.
  if (folded.length !== plain.length) return null
  const at = terms
    .map((term) => folded.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0]
  if (at === undefined) return null
  let start = Math.max(0, at - 30)
  if (start > 0) {
    const space = plain.indexOf(' ', start)
    start = space >= 0 && space < at ? space + 1 : start
  }
  let end = Math.min(plain.length, start + length)
  if (end < plain.length) {
    const space = plain.lastIndexOf(' ', end)
    end = space > at ? space : end
  }
  return `${start > 0 ? '…' : ''}${plain.slice(start, end)}${end < plain.length ? '…' : ''}`
}

/**
 * The order search results are grouped in, before "Actions" (commands, always first when any match) and
 * whatever a search does not name here (put last, in whatever order it was given). See
 * `docs/DECISIONS.md`, "Global search" for why this order and not a relevance score.
 */
export const SEARCH_GROUP_ORDER = ['actions', 'people', 'notes', 'meetings', 'training', 'readings']

/** What `in:` may be followed by, and which source it means. Plural or singular, either is fine. */
const SOURCE_ALIASES: Record<string, string> = {
  person: 'people',
  people: 'people',
  note: 'notes',
  notes: 'notes',
  meeting: 'meetings',
  meetings: 'meetings',
  training: 'training',
  trainings: 'training',
  reading: 'readings',
  readings: 'readings'
}

export interface ParsedSearch {
  /** Source ids to search (from one or more `in:` words); null means everything. */
  sources: string[] | null
  /** The query with every `in:` word removed. */
  text: string
}

/**
 * Slack- and Gmail-style `in:` modifiers: `in:meetings luminos` searches only meetings for "luminos". More than
 * one `in:` searches all of them. An `in:` naming nothing recognised is left in the text (so `in:progress`, part
 * of an ordinary phrase, is not silently dropped).
 */
export function parseSearchQuery(raw: string): ParsedSearch {
  const sources = new Set<string>()
  const words = raw.split(/\s+/).filter(Boolean)
  const rest = words.filter((word) => {
    const match = /^in:(.+)$/i.exec(word)
    const source = match && SOURCE_ALIASES[match[1].toLowerCase()]
    if (!source) return true
    sources.add(source)
    return false
  })
  return { sources: sources.size > 0 ? [...sources] : null, text: rest.join(' ') }
}
