import { parseTodos } from './todos'
import { parseHeading, scanLines } from './sections'
import { parseTopics } from './topics'

/** A line that is only a bold title: `**Title**`, `**Title:**` or `**Title**:`. */
const BOLD_ONLY = /^ {0,3}\*\*(?!\s|\*)([^*]*[^*\s])\*\*[ \t]*:?[ \t]*$/
/** Longer than this it is more likely an emphasised sentence than a title. */
const MAX_TITLE = 100

export interface ConvertedLine {
  /** Zero-based line index in the body. */
  line: number
  from: string
  to: string
}

export interface LeftAlone {
  line: number
  text: string
  reason: string
}

export interface PseudoHeadingResult {
  /** The body with the bold titles turned into `### ` headings (the original when nothing changed). */
  body: string
  converted: ConvertedLine[]
  /** Bold-only lines that were not converted, and why, so nothing is silently skipped. */
  leftAlone: LeftAlone[]
  /** Set when the note was left untouched on purpose or because the safety check failed. */
  problems: string[]
}

/**
 * Turn the bold pseudo-headings (`**Topic**` on a line of its own) under `## Notes` into `### Topic`
 * headings, so they show up in the topics panel. Only the text of those lines changes: every other
 * character, line ending and blank line stays as it was.
 *
 * A line is converted only when it is in the Notes section, outside code fences, is nothing but one
 * bold span (an optional trailing colon is dropped), is short, is not a TODO, and follows a blank
 * line or a heading, so a bold line inside a paragraph is never touched. A note whose Notes section
 * already has `###` headings is left alone entirely (its bold lines are then most likely emphasis).
 *
 * The result is checked before it is returned: the same number of lines, every other line identical,
 * the TODOs (text, owners, ticked state) unchanged and each converted line now a topic. If any check
 * fails the note comes back unchanged with the reason in `problems`.
 */
export function convertPseudoHeadings(body: string): PseudoHeadingResult {
  const lines = scanLines(body)
  const converted: ConvertedLine[] = []
  const leftAlone: LeftAlone[] = []
  const unchanged = (problems: string[]): PseudoHeadingResult => ({
    body,
    converted: [],
    leftAlone,
    problems
  })

  let inNotes = false
  let hasTopics = false
  const candidates: { line: number; title: string }[] = []
  lines.forEach((l, i) => {
    if (l.inFence) return
    const h = parseHeading(l.text)
    if (h) {
      if (h.level <= 2) inNotes = h.level === 2 && h.text.toLowerCase() === 'notes'
      else if (h.level === 3 && inNotes) hasTopics = true
      return
    }
    const m = BOLD_ONLY.exec(l.text)
    if (!m) return
    const title = m[1].trim().replace(/:$/, '').trim()
    const reject = (reason: string): void => {
      leftAlone.push({ line: i, text: l.text.trim(), reason })
    }
    if (/^TODO\b/i.test(title)) return
    if (!inNotes) return reject('not in the Notes section')
    if (title.length > MAX_TITLE) return reject('too long to be a title')
    if (title === '') return reject('empty')
    const prev = i === 0 ? null : lines[i - 1]
    const afterBlank = prev === null || prev.text.trim() === '' || parseHeading(prev.text) !== null
    if (!afterBlank || (prev && prev.inFence)) return reject('not on a line of its own')
    candidates.push({ line: i, title })
  })

  if (candidates.length === 0) return unchanged([])
  if (hasTopics) {
    for (const c of candidates)
      leftAlone.push({
        line: c.line,
        text: lines[c.line].text.trim(),
        reason: 'the note already has ### topics'
      })
    return unchanged(['the note already has ### topics'])
  }

  const byLine = new Map(candidates.map((c) => [c.line, c.title]))
  let out = ''
  let pos = 0
  for (const [i, l] of lines.entries()) {
    const title = byLine.get(i)
    if (title === undefined) continue
    const to = `### ${title}`
    converted.push({ line: i, from: l.text, to })
    out += body.slice(pos, l.start) + to
    pos = l.start + l.text.length
  }
  out += body.slice(pos)

  const problems = checkConversion(body, out, converted)
  if (problems.length > 0) return unchanged(problems)
  return { body: out, converted, leftAlone, problems: [] }
}

/** The safety check: what must still be true of the converted body. Empty means it passed. */
export function checkConversion(
  before: string,
  after: string,
  converted: ConvertedLine[]
): string[] {
  const problems: string[] = []
  const a = scanLines(before)
  const b = scanLines(after)
  if (a.length !== b.length) problems.push('the number of lines changed')
  else {
    const changed = new Set(converted.map((c) => c.line))
    a.forEach((l, i) => {
      if (!changed.has(i) && l.text !== b[i].text) problems.push(`line ${i + 1} changed`)
    })
  }
  const todos = (s: string): string =>
    JSON.stringify(parseTodos(s).map(({ kind, owners, text, done }) => [kind, owners, text, done]))
  if (todos(before) !== todos(after)) problems.push('the TODOs changed')
  const topics = parseTopics(after).map((t) => t.text)
  if (JSON.stringify(topics) !== JSON.stringify(converted.map((c) => c.to.slice(4))))
    problems.push('the converted lines do not read back as the topics')
  return problems
}
