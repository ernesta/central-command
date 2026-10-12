import { markdownLanguage } from '@codemirror/lang-markdown'

/**
 * One bullet character for a whole note (requested 12 Oct 2026): every list marker written `*` or `+` becomes `-`.
 * Markdown starts a new list when the character changes, so a note that mixed them had lists that looked like one.
 *
 * Only a real list marker is touched (read from the Markdown syntax tree): a `*` in a code block, a horizontal rule
 * such as `* * *`, emphasis, and numbered lists are left alone. A task's `* [ ]` is a bullet too. The caller passes the
 * note's body, never its front matter.
 */
export function standardiseBullets(body: string): { text: string; changed: number } {
  const marks: number[] = []
  markdownLanguage.parser.parse(body).iterate({
    enter(node) {
      if (node.name === 'ListMark' && /^[*+]$/.test(body.slice(node.from, node.to)))
        marks.push(node.from)
    }
  })
  let text = body
  for (const at of marks.reverse()) text = text.slice(0, at) + '-' + text.slice(at + 1)
  return { text, changed: marks.length }
}

/** Is `after` the note with only list markers changed to `-`? A safety check before anything is written. */
export function onlyBulletsChanged(before: string, after: string): boolean {
  if (before.length !== after.length) return false
  const marks = new Set<number>()
  for (let i = 0; i < before.length; i++) {
    if (before[i] === after[i]) continue
    if (after[i] !== '-' || (before[i] !== '*' && before[i] !== '+')) return false
    marks.add(i)
  }
  const lineStart = (i: number): boolean =>
    /^[ \t>]*$/.test(before.slice(before.lastIndexOf('\n', i - 1) + 1, i))
  return [...marks].every((i) => lineStart(i) && /^[ \t]/.test(before.slice(i + 1, i + 2) || ' '))
}
