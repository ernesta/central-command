/** One line of a note body, with where it starts and whether it is inside a fenced code block. */
export interface BodyLine {
  text: string
  /** Offset of the line's first character in the body. */
  start: number
  /** True for the fence lines themselves and everything between them. */
  inFence: boolean
}

/**
 * Split a body into lines (LF or CRLF; the terminator is not part of `text`) and mark fenced code, so
 * that a `## Heading` or `**TODO**` inside a code block is never mistaken for the real thing.
 */
export function scanLines(body: string): BodyLine[] {
  return scan(body).lines
}

/**
 * `scanLines`, plus the index of the line that opens a code fence which is never closed (Markdown
 * lets it swallow the rest of the note), or null when every fence is closed.
 */
export function scan(body: string): { lines: BodyLine[]; unclosedFenceAt: number | null } {
  const lines: BodyLine[] = []
  let fence: { char: string; length: number; at: number } | null = null
  let start = 0
  for (const raw of body.split('\n')) {
    const text = raw.endsWith('\r') ? raw.slice(0, -1) : raw
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(text)
    let inFence = fence !== null
    if (fence) {
      const close = open && open[1][0] === fence.char && open[1].length >= fence.length
      if (close && text.slice(open[0].length).trim() === '') fence = null
    } else if (open) {
      fence = { char: open[1][0], length: open[1].length, at: lines.length }
      inFence = true
    }
    lines.push({ text, start, inFence })
    start += raw.length + 1
  }
  return { lines, unclosedFenceAt: fence ? fence.at : null }
}

export interface Heading {
  level: number
  text: string
}

/** An ATX heading (`## Title`, optional closing hashes), or null. Not for lines inside code fences. */
export function parseHeading(line: string): Heading | null {
  const m = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*$/.exec(line)
  if (!m) return null
  const text = m[2].replace(/[ \t]+#+$/, '').trim()
  return { level: m[1].length, text }
}

/**
 * The Markdown under a level-2 heading called `title` (case-insensitive), up to the next heading of
 * level 1 or 2, trimmed. Null if there is no such heading.
 */
export function extractSection(body: string, title: string): string | null {
  const lines = scanLines(body)
  const wanted = title.trim().toLowerCase()
  const at = lines.findIndex((l) => {
    if (l.inFence) return false
    const h = parseHeading(l.text)
    return h !== null && h.level === 2 && h.text.toLowerCase() === wanted
  })
  if (at === -1) return null
  const out: string[] = []
  for (const l of lines.slice(at + 1)) {
    if (!l.inFence) {
      const h = parseHeading(l.text)
      if (h && h.level <= 2) break
    }
    out.push(l.text)
  }
  return out.join('\n').trim()
}
