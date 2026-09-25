import {
  idFromNoteFileName,
  isSafeNoteId,
  notePath,
  safeNamePart
} from '../../../main/notes/file-name'

const MAX_NAME_LENGTH = 80

/** "Methods: participants" gives "Methods participants" and "12:30 call" gives "12-30 call": a colon is not allowed in a file name. */
function withoutColons(title: string): string {
  return title.replace(/:\s+/g, ' ').replace(/:/g, '-')
}

/** The name a note's file wants, from its title: `Methods participants`, or `Untitled` without one. No number yet. */
export function noteStem(title: string): string {
  return safeNamePart(withoutColons(title), 'Untitled', MAX_NAME_LENGTH)
}

/**
 * The base name (no extension) for a note: its title, and `… 2`, `… 3` when that is taken. `taken` holds the
 * base names already in use; comparison ignores case because macOS file systems do.
 */
export function noteBaseName(title: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((n) => n.toLowerCase()))
  const stem = noteStem(title)
  if (!used.has(stem.toLowerCase())) return stem
  for (let n = 2; ; n++) {
    const candidate = `${stem} ${n}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
}

/** True when `id` is already the stem, or the stem with a number: such a file is not renamed again. */
export function nameMatchesTitle(id: string, title: string): boolean {
  const stem = noteStem(title).toLowerCase()
  const lower = id.toLowerCase()
  return (
    lower === stem || (lower.startsWith(`${stem} `) && /^\d+$/.test(lower.slice(stem.length + 1)))
  )
}

export const isSafeNoteFileId = isSafeNoteId

export const notesPath = (dir: string, id: string): string => notePath(dir, id, 'note')

/** The id of a note file name (`x.md` gives `x`), or null if it is not a note. */
export const idFromFileName = idFromNoteFileName
