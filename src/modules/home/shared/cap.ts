/** How many rows Home's "Today" and "Coming up" show each; the rest is a quiet "+N more" under the list. */
export const SHOWN_ROWS = 5

/**
 * The first `limit` rows of a list as displayed, and how many are not shown: the rows cut here plus `hidden`, the ones the
 * summary already left out (it caps its own lists, but carries their whole counts).
 */
export function capRows<T>(
  rows: readonly T[],
  hidden = 0,
  limit = SHOWN_ROWS
): { shown: T[]; more: number } {
  const shown = rows.slice(0, limit)
  return { shown, more: rows.length - shown.length + hidden }
}
