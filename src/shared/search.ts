import type { SearchRequest } from './search-query'
import type { Workspace } from './settings'
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

/** One place the global search looks: a module's items, the people list, or the commands. */
export interface Searchable {
  id: string
  label: string
  /** The workspace its items belong to; null for what belongs to none (people, readings, commands): `workspace:` keeps those. */
  workspace: Workspace | null
  /** `limit` is how many of the best matches to return; each source's own default (usually 6) when left out. */
  search: (request: SearchRequest, limit?: number) => Promise<SearchHit[]>
}

/** The words of a search, folded (accents and case do not matter); every word has to match. */
export function searchTerms(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean)
}

/**
 * Items whose name has every search word, those starting with the first word before the rest; the order given is kept
 * within each group. The picker needs this: a word such as "ampl" is in the text of many notes ("sample"), and the note
 * called AMPL must not be pushed out of the few places offered.
 */
export function nameFirst<T>(items: readonly T[], names: (item: T) => string, query: string): T[] {
  const terms = searchTerms(query)
  if (terms.length === 0) return [...items]
  const rank = (item: T): number => {
    const name = fold(names(item))
    if (!terms.every((t) => name.includes(t))) return 2
    return name.startsWith(terms[0]) ? 0 : 1
  }
  return items
    .map((item, index) => ({ item, index, rank: rank(item) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((x) => x.item)
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
export const SEARCH_GROUP_ORDER = [
  'actions',
  'people',
  'notes',
  'meetings',
  'tasks',
  'training',
  'readings',
  'reading-lists'
]
