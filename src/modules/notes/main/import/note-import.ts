import { parseHead, splitNote, updateHeadKeys, type Value } from '@shared/front-matter'
import { parseMeta } from '../../shared/front-matter'
import { noteBaseName } from '../file-name'

/** The vault folders whose notes are imported. Readings, Meetings, Training and Assets already have their own homes. */
export const IMPORT_FOLDERS = ['Data Sources', 'Ideas', 'Thesis', 'Placement'] as const

/** One note in the vault, as the importer sees it. */
export interface SourceNote {
  /** Relative to the vault, with `/`: "Data Sources/ASER.md". */
  path: string
  content: string
  /** When the file was created (YYYY-MM-DD), or '' when the vault does not say. */
  created: string
}

export type PlanItem =
  | {
      status: 'import'
      source: SourceNote
      title: string
      /** The file to create in the notes folder. */
      target: string
      /** The whole new file. */
      markdown: string
    }
  /** A note that an earlier run already brought over (a file in the notes folder remembers where it came from). */
  | { status: 'skip-imported'; source: SourceNote; existing: string }
  /** A converted note that did not match its source, so it is left out. */
  | { status: 'failed-check'; source: SourceNote; problems: string[] }

const ORDER = ['title', 'group', 'subgroup', 'pinned', 'created', 'imported-from']

/** The note's name without the folder and the extension. */
export function titleOf(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.md$/i, '')
}

/**
 * The note as it will be written: the body is copied exactly as it is, and the front matter gets a title (the
 * file name), a created date and where it came from, each only if the note does not already say so. Everything
 * the note already had in its front matter stays as it was. The note arrives ungrouped.
 */
export function convertNote(source: SourceNote): { markdown: string; title: string } {
  const { head, body } = splitNote(source.content)
  const existing = new Map(parseHead(head)?.entries.map((e) => [e.key, true]) ?? [])
  const title = titleOf(source.path)
  const patch: Record<string, Value> = {}
  if (!existing.has('title')) patch.title = title
  if (!existing.has('created') && source.created) patch.created = source.created
  if (!existing.has('imported-from')) patch['imported-from'] = source.path
  const newHead = updateHeadKeys(head, patch, {
    order: ORDER,
    style: (key) => (key === 'created' ? 'plain' : 'auto')
  })
  return { markdown: newHead + body, title }
}

function headLines(head: string): string[] {
  const parsed = parseHead(head)
  return parsed ? [...parsed.leading, ...parsed.entries.flatMap((e) => e.lines)] : []
}

/** True when every line of `wanted` appears in `lines`, in the same order. */
function isSubsequence(wanted: readonly string[], lines: readonly string[]): boolean {
  let at = 0
  for (const line of lines) if (at < wanted.length && line === wanted[at]) at++
  return at === wanted.length
}

const count = (text: string, pattern: RegExp): number => (text.match(pattern) ?? []).length

/**
 * What is wrong with a converted note, compared with its source; an empty list means it is safe to write.
 * The text must be byte for byte the same, every line the note already had in its front matter must still be
 * there in the same order, and the result must read back as a note with no problems. TODO words and ticked and
 * unticked checkboxes are counted as a second, independent check on the text.
 */
export function checkConversion(source: SourceNote, markdown: string): string[] {
  const problems: string[] = []
  const before = splitNote(source.content)
  const after = splitNote(markdown)
  if (after.body !== before.body) problems.push('The text is not the same as in the vault')
  if (count(after.body, /\n/g) !== count(before.body, /\n/g))
    problems.push('The line count changed')
  if (count(after.body, /TODO/g) !== count(before.body, /TODO/g)) problems.push('A TODO changed')
  for (const [name, pattern] of [
    ['ticked', /^\s*[-*+] \[[xX]\]/gm],
    ['unticked', /^\s*[-*+] \[ \]/gm]
  ] as const) {
    if (count(after.body, pattern) !== count(before.body, pattern)) {
      problems.push(`The number of ${name} boxes changed`)
    }
  }
  if (!isSubsequence(headLines(before.head), headLines(after.head))) {
    problems.push('The note’s own front matter changed')
  }
  const { meta, problems: readBack } = parseMeta(after.head)
  problems.push(...readBack)
  if (!meta.title) problems.push('The note has no title')
  return problems
}

/** Where notes already in the notes folder came from: `imported-from` value to file name. */
export function importedFromOf(
  files: readonly { name: string; content: string }[]
): Map<string, string> {
  const found = new Map<string, string>()
  for (const file of files) {
    const entry = parseHead(splitNote(file.content).head)?.entries.find(
      (e) => e.key === 'imported-from'
    )
    const value = entry?.lines[0]
      .slice('imported-from:'.length)
      .trim()
      .replace(/^['"]|['"]$/g, '')
    if (value) found.set(value, file.name)
  }
  return found
}

/**
 * Decide what to do with each note. Files already in the notes folder are never touched: a new note takes a
 * free name (`… 2`, `… 3` when the name is taken, also by an earlier note in this same plan), and a note that
 * an earlier run already imported is skipped, so running the import twice does not double anything up.
 */
export function planNoteImport(
  sources: readonly SourceNote[],
  existingNames: Iterable<string>,
  alreadyImported: ReadonlyMap<string, string> = new Map()
): PlanItem[] {
  const taken = new Set([...existingNames].map((n) => n.replace(/\.md$/, '')))
  return sources.map((source): PlanItem => {
    const existing = alreadyImported.get(source.path)
    if (existing) return { status: 'skip-imported', source, existing }
    const { markdown, title } = convertNote(source)
    const problems = checkConversion(source, markdown)
    if (problems.length > 0) return { status: 'failed-check', source, problems }
    const name = noteBaseName(title, taken)
    taken.add(name)
    return { status: 'import', source, title, target: `${name}.md`, markdown }
  })
}
