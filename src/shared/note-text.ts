/**
 * Ranges of a note's Markdown that a text rewrite must never touch: front matter (its fields are structured data, not
 * prose), fenced and inline code, text that is already a link, bare URLs, and headings. Shared by the passes that turn
 * plain text into entities (`citations.ts`, `people-mentions.ts`), so they all agree on what is off limits.
 */
export function protectedRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  const front = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(text)
  if (front) ranges.push([0, front[0].length])
  let offset = 0
  let fenced = false
  for (const line of text.split('\n')) {
    const end = offset + line.length
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced
      ranges.push([offset, end])
    } else if (fenced || /^\s{0,3}#{1,6}\s/.test(line)) ranges.push([offset, end])
    offset = end + 1
  }
  for (const re of [/`[^`\n]*`/g, /\[[^\]\n]*\]\([^)\n]*\)/g, /<?https?:\/\/[^\s)>]+>?/g]) {
    for (const m of text.matchAll(re)) ranges.push([m.index, m.index + m[0].length])
  }
  return ranges
}

/** True when [start, end) overlaps any protected range. */
export function isProtected(ranges: Array<[number, number]>, start: number, end: number): boolean {
  return ranges.some(([a, b]) => start < b && end > a)
}
