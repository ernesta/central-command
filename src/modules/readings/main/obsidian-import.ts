import type { SyncedFields } from '../shared/types'
import { fold } from './query'
import { noteFileName } from './notes-path'

/** One Obsidian literature note, split into the parts that matter for importing it. */
export interface ObsidianNote {
  fileName: string
  /** The citekey in the file name, e.g. "Cayado2025" for "@Cayado2025.md" (an old-style key). */
  oldKey: string
  title: string
  year: number | null
  /** Everything after the plugin's header: what the user actually wrote. */
  body: string
}

/**
 * Split a note made by Obsidian's Citation plugin. Its template is front matter
 * (Authors/Year/Link), then `# Title`, then the abstract as a blockquote, then a rule.
 * The header repeats what Zotero already provides, so only the body is kept.
 */
export function parseObsidianNote(fileName: string, text: string): ObsidianNote {
  const oldKey = fileName.replace(/\.md$/i, '').replace(/^@/, '')
  let rest = text.replace(/\r\n?/g, '\n')
  let year: number | null = null

  const front = rest.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/)
  if (front) {
    const yearLine = front[1].match(/^Year:\s*(\d{4})/im)
    if (yearLine) year = Number(yearLine[1])
    rest = rest.slice(front[0].length)
  }

  const lines = rest.split('\n')
  let i = 0
  const skipBlank = (): void => {
    while (i < lines.length && lines[i].trim() === '') i++
  }
  skipBlank()
  let title = ''
  const heading = lines[i]?.match(/^#\s+(.+?)\s*$/)
  if (heading) {
    title = heading[1]
    i++
    skipBlank()
    while (i < lines.length && lines[i].startsWith('>')) i++ // the abstract
    skipBlank()
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i] ?? '')) i++
  }
  return { fileName, oldKey, title, year, body: lines.slice(i).join('\n') }
}

/**
 * Obsidian-only syntax and template leftovers removed; returns Markdown ready for the app. Readings notes drop
 * empty template headings and bullets; meeting notes keep them (`keepEmpty…`), because a heading followed
 * straight by another heading (`## Notes` then `### Topic`) is structure, not an empty template section.
 */
export function transformBody(
  body: string,
  options: { keepEmptyHeadings?: boolean; keepEmptyBullets?: boolean } = {}
): { markdown: string; empty: boolean } {
  const cleaned = body
    .replace(/\r\n?/g, '\n')
    // [[Page|shown text]] -> shown text; [[Page]] and ![[Page]] -> Page
    .replace(/!?\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/!?\[\[([^\]]+)\]\]/g, '$1')
    // Tab indentation -> two spaces per level
    .replace(/^\t+/gm, (tabs) => '  '.repeat(tabs.length))
    // Empty placeholder bullets left by the template
    .split('\n')
    .filter((line) => options.keepEmptyBullets || !/^\s*[-*+]\s*$/.test(line))

  // Drop headings that no longer have anything under them (e.g. an unused "Key Quotes").
  const kept: string[] = []
  for (let n = 0; n < cleaned.length; n++) {
    const line = cleaned[n]
    if (!options.keepEmptyHeadings && /^#{1,6}\s/.test(line)) {
      let next = n + 1
      while (next < cleaned.length && cleaned[next].trim() === '') next++
      const followedByContent = next < cleaned.length && !/^#{1,6}\s/.test(cleaned[next])
      if (!followedByContent) continue
    }
    kept.push(line)
  }

  // The editor puts a blank line around every heading and drops trailing spaces. Do the same
  // so an imported note is already in the editor's canonical form and is not rewritten the
  // first time it is edited.
  const isHeading = (line: string | undefined): boolean =>
    line !== undefined && /^#{1,6}\s/.test(line)
  const spaced = kept
    .map((line) => line.replace(/[ \t]+$/, ''))
    .flatMap((line, n, all) => {
      const before = n > 0 && isHeading(line) && all[n - 1] !== '' ? [''] : []
      const after = isHeading(line) && all[n + 1] !== undefined && all[n + 1] !== '' ? [''] : []
      return [...before, line, ...after]
    })
  const markdown = spaced
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const hasText = markdown.split('\n').some((line) => line.trim() !== '' && !/^#{1,6}\s/.test(line))
  return { markdown: hasText ? `${markdown}\n` : '', empty: !hasText }
}

const normalise = (title: string): string =>
  fold(title)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export type MatchKind = 'title' | 'title-prefix'
export type MatchResult =
  | { status: 'matched'; reading: SyncedFields; kind: MatchKind }
  | { status: 'ambiguous'; candidates: SyncedFields[] }
  | { status: 'unmatched' }

/**
 * Find the reading a note is about. The note's own title and year are the bridge, because the
 * citekeys in old file names ("Cayado2025") differ from today's Better BibTeX ones. An exact
 * title match wins; otherwise a title that starts the other one (Zotero often holds a shortened
 * title) counts, provided the year agrees and the result is unique.
 */
export function matchNote(note: ObsidianNote, readings: readonly SyncedFields[]): MatchResult {
  const title = normalise(note.title)
  if (!title) return { status: 'unmatched' }
  const sameYear = (r: SyncedFields): boolean => note.year === null || r.year === note.year

  const exact = readings.filter((r) => normalise(r.fullTitle) === title && sameYear(r))
  if (exact.length === 1) return { status: 'matched', reading: exact[0], kind: 'title' }
  if (exact.length > 1) return { status: 'ambiguous', candidates: exact }

  const MIN_WORDS = 3
  const prefix = readings.filter((r) => {
    if (note.year === null || r.year !== note.year) return false
    const other = normalise(r.fullTitle)
    const [short, long] = other.length <= title.length ? [other, title] : [title, other]
    return short.split(' ').length >= MIN_WORDS && long.startsWith(short)
  })
  if (prefix.length === 1) return { status: 'matched', reading: prefix[0], kind: 'title-prefix' }
  if (prefix.length > 1) return { status: 'ambiguous', candidates: prefix }
  return { status: 'unmatched' }
}

export type ImportItem =
  | {
      status: 'import'
      note: ObsidianNote
      reading: SyncedFields
      kind: MatchKind
      markdown: string
      target: string
    }
  | { status: 'skip-empty'; note: ObsidianNote; reading: SyncedFields }
  | { status: 'skip-exists'; note: ObsidianNote; reading: SyncedFields; target: string }
  | { status: 'skip-duplicate'; note: ObsidianNote; reading: SyncedFields; firstNote: string }
  | { status: 'ambiguous'; note: ObsidianNote; candidates: SyncedFields[] }
  | { status: 'unmatched'; note: ObsidianNote }

/**
 * Decide what to do with each note. Nothing here touches disk. A note is only ever imported
 * as a new file: if the reading already has a notes file it is skipped, never overwritten.
 */
export function planImport(
  notes: readonly ObsidianNote[],
  readings: readonly SyncedFields[],
  existingNoteFiles: ReadonlySet<string>
): ImportItem[] {
  const claimed = new Map<string, string>()
  return notes.map((note): ImportItem => {
    const match = matchNote(note, readings)
    if (match.status === 'unmatched') return { status: 'unmatched', note }
    if (match.status === 'ambiguous')
      return { status: 'ambiguous', note, candidates: match.candidates }

    const { reading } = match
    const target = noteFileName(reading.citekey)
    const { markdown, empty } = transformBody(note.body)
    if (empty) return { status: 'skip-empty', note, reading }
    if (existingNoteFiles.has(target)) return { status: 'skip-exists', note, reading, target }
    const first = claimed.get(target)
    if (first) return { status: 'skip-duplicate', note, reading, firstNote: first }
    claimed.set(target, note.fileName)
    return { status: 'import', note, reading, kind: match.kind, markdown, target }
  })
}
