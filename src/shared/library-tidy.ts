/**
 * Pure rules for tidying the library's Markdown (used by `scripts/tidy-library.mts`, tested without files).
 *
 * - `removeEmptyNotes`: a `## Notes` heading with nothing under it goes.
 * - `fixEscapedLinks`: links the old editor escaped (`\[text]\(<url>)`) become `[text](url)`.
 * - `convertMath`: LaTeX spans (`$\rightarrow$`, `$d = .44$`) become plain Unicode and APA-style statistics: an arrow, an
 *   italic letter, spaces around `=`, and always a leading zero (`*d* = 0.44`).
 *
 * Each returns the new text and what it left alone, so the script can report instead of guessing.
 */

/** Fenced code blocks and inline code are never touched. */
function mapOutsideCode(text: string, fn: (segment: string) => string): string {
  let fenced = false
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced
        return line
      }
      if (fenced) return line
      return line
        .split(/(`[^`]*`)/)
        .map((part, i) => (i % 2 === 1 ? part : fn(part)))
        .join('')
    })
    .join('\n')
}

export function removeEmptyNotes(text: string): string {
  const lines = text.split('\n')
  const at = lines.findIndex((l) => /^## Notes\s*$/.test(l))
  if (at < 0) return text
  let end = at + 1
  while (end < lines.length && !/^## /.test(lines[end])) end++
  if (lines.slice(at + 1, end).some((l) => l.trim() !== '')) return text
  // Drop the heading and its blank lines, and the blank line that separated it from what came before.
  let start = at
  while (start > 0 && lines[start - 1].trim() === '') start--
  const rest = lines.slice(end)
  const kept = lines.slice(0, start)
  if (rest.length === 0) return kept.join('\n') + '\n'
  return [...kept, '', ...rest].join('\n')
}

const unescape = (s: string): string => s.replace(/\\(.)/g, '$1')

export function fixEscapedLinks(text: string): string {
  return (
    text
      // \[text]\([https://x](https://x/))  (the editor wrapped an already-linked address again)
      .replace(/\\\[([^\]\n]+)\]\\\(\[[^\]\n]*\]\((<?)([^)\s>]+)>?\)\)/g, '[$1]($3)')
      // \[text]\(<https://x>)
      .replace(/\\\[([^\]\n]+)\]\\\(<([^>\s]+)>\)/g, '[$1]($2)')
      // \[text]\(https\://x\.y/z)
      .replace(
        /\\\[([^\]\n]+)\]\\\(((?:\\.|[^)\s\\])+)\)/g,
        (_m, label, url) => `[${label}](${unescape(url)})`
      )
  )
}

const num = (s: string): string => s.replace(/^(-|−)?\./, (_m, sign) => `${sign ?? ''}0.`)
const minus = (s: string): string => s.replace(/(^|[^\w])-(?=\d|\.)/g, '$1−')

/** The plain text for one LaTeX span's inside, or null when it is not a shape we know. */
export function mathToText(inner: string): string | null {
  if (/^\s|\s$/.test(inner)) return null
  const arrows = inner.replace(/\s*\\rightarrow\s*/g, ' → ')
  if (arrows !== inner) {
    const rest = arrows.replace(/ → /g, '')
    return /[\\{}^_$]/.test(rest) ? null : arrows.trim()
  }
  if (/^[−-]?\d*\.?\d+$/.test(inner)) return minus(num(inner))
  const stat = /^([A-Za-z]{1,2})\s*=\s*(.+)$/.exec(inner)
  if (stat) {
    const [, name, value] = stat
    const range = /^(\.?\d+(?:\.\d+)?)\s*[-–]\s*(\.?\d+(?:\.\d+)?)$/.exec(value)
    const shown = range
      ? `${num(range[1])}–${num(range[2])}`
      : /^[−-]?\d*\.?\d+$/.test(value)
        ? minus(num(value))
        : null
    if (shown === null) return null
    return `${name.length === 1 ? `*${name}*` : name} = ${shown}`
  }
  return null
}

export function convertMath(text: string): { text: string; left: string[] } {
  const left: string[] = []
  const out = mapOutsideCode(text, (segment) =>
    segment.replace(/\$([^$\n]+)\$/g, (whole, inner: string) => {
      const plain = mathToText(inner)
      if (plain === null) {
        if (/\\|[=^_]/.test(inner)) left.push(whole)
        return whole
      }
      return plain
    })
  )
  return { text: out, left }
}
