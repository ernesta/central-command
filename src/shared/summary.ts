/** The row's `## Summary` section has text (the index keeps it trimmed; an empty or blank section is `''`). */
export function hasSummary(row: { summary: string }): boolean {
  return row.summary.trim() !== ''
}
