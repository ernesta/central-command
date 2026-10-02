import { parseHeading, scan } from './sections'

/**
 * The body with every blank line next to a heading taken out, so a heading sits directly above its text and
 * directly below the text before it (the editor draws the space itself). Blank lines between paragraphs, lists
 * and other blocks stay, and so does anything inside a code fence, a run of blank lines at the very start of the
 * body, and every line break's style (LF or CRLF). Only blank lines are ever removed.
 */
export function tightenHeadings(body: string): string {
  const raw = body.split('\n')
  const { lines } = scan(body)
  const blank = lines.map((l) => !l.inFence && l.text.trim() === '')
  // What follows the final line break is not a line.
  if (raw.length > 1 && raw[raw.length - 1] === '') blank[raw.length - 1] = false
  const heading = lines.map((l) => !l.inFence && parseHeading(l.text) !== null)
  const drop = new Array<boolean>(raw.length).fill(false)
  for (let a = 0; a < raw.length;) {
    if (!blank[a]) {
      a++
      continue
    }
    let b = a
    while (b + 1 < raw.length && blank[b + 1]) b++
    const afterHeading = a > 0 && heading[a - 1]
    const beforeHeading = a > 0 && b + 1 < raw.length && heading[b + 1]
    if (afterHeading || beforeHeading) for (let i = a; i <= b; i++) drop[i] = true
    a = b + 1
  }
  return raw.filter((_, i) => !drop[i]).join('\n')
}
