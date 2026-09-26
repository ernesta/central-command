import { fold } from './text'

/** One result of the global search: where it is, what to call it, and one line about it. */
export interface SearchHit {
  /** Unique within the module. */
  key: string
  title: string
  /** One line: the part of the text that matched, or the details of the item. */
  detail: string
  /** Where clicking the result goes. */
  route: string
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
