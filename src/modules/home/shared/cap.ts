/** How many rows Home's "Today" and "Coming up" show each; the rest is a quiet "+N more" under the list. */
export const SHOWN_ROWS = 5

/**
 * The first `limit` top-level rows of a list as displayed (a row `isKid` says hangs under another stays with its parent and is not
 * counted), and how many top-level rows are not shown: the ones cut here plus `hidden`, the ones the summary already left out.
 */
export function capRows<T>(
  rows: readonly T[],
  hidden = 0,
  limit = SHOWN_ROWS,
  isKid: (row: T) => boolean = () => false
): { shown: T[]; more: number } {
  const shown: T[] = []
  let top = 0
  let cut = 0
  for (const row of rows) {
    if (!isKid(row)) top += 1
    if (top <= limit) shown.push(row)
    else if (!isKid(row)) cut += 1
  }
  return { shown, more: cut + hidden }
}
