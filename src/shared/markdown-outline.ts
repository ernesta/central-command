export interface OutlineItem {
  /** 1 to 6, the heading's `#` count. */
  level: number
  text: string
}

/** Plain text of a heading: emphasis marks, code ticks and link syntax removed. */
function plainHeading(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+#+\s*$/, '')
    .trim()
}

export interface LocatedOutlineItem extends OutlineItem {
  /** The heading's line in the Markdown, counting from 0 (a line break of either kind ends a line). */
  line: number
}

/**
 * The headings of a Markdown document, in order, for an outline that jumps to them. Only the given levels are
 * kept (the Training plan wants `##` and `###`; a note's outline wants whatever is there). Headings inside
 * fenced code blocks are skipped, since they are not really headings.
 */
export function markdownOutline(markdown: string, levels: readonly number[]): OutlineItem[] {
  return locatedOutline(markdown, levels).map(({ level, text }) => ({ level, text }))
}

/** `markdownOutline` with each heading's line, for an editor that can be sent to a line (the live editor). */
export function locatedOutline(markdown: string, levels: readonly number[]): LocatedOutlineItem[] {
  const wanted = new Set(levels)
  const items: LocatedOutlineItem[] = []
  let fenced = false
  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced
      continue
    }
    if (fenced) continue
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line)
    if (!match) continue
    const level = match[1].length
    if (!wanted.has(level)) continue
    const text = plainHeading(match[2])
    if (text) items.push({ level, text, line: index })
  }
  return items
}
