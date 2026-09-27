import { fold } from '@shared/text'
import type { ReadingListIndexRow } from './types'

/** A list's title, or "Untitled list" when it has none. */
export function displayTitle(row: Pick<ReadingListIndexRow, 'title'>): string {
  return row.title || 'Untitled list'
}

/** Lists most recently edited first (ties by id, so the order is always the same). */
export function compareRecent(a: ReadingListIndexRow, b: ReadingListIndexRow): number {
  return b.edited - a.edited || a.id.localeCompare(b.id)
}

/** Every word of `search` must match somewhere in the title or the list's own text (accent- and case-insensitive). */
export function queryLists(
  rows: readonly ReadingListIndexRow[],
  search: string
): ReadingListIndexRow[] {
  const terms = fold(search).split(/\s+/).filter(Boolean)
  const matches = (row: ReadingListIndexRow): boolean => {
    const haystack = fold(`${displayTitle(row)} ${row.excerpt}`)
    return terms.every((t) => haystack.includes(t))
  }
  return [...rows].filter(matches).sort(compareRecent)
}
