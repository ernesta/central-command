import { basename, join } from 'path'

// eslint-disable-next-line no-control-regex
const UNSAFE = /[\\/:*?"<>|\u0000-\u001f]/g

/** Text made safe to use inside a file name: unsafe characters become `_`, spaces collapse, no leading dot. */
export function safeNamePart(text: string, fallback: string, maxLength: number): string {
  const cleaned = text
    .replace(UNSAFE, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '_')
    .slice(0, maxLength)
    .trim()
  return cleaned || fallback
}

/**
 * A base name (no extension) that is not in `taken`: `YYYY-MM-DD Label`, then `… 2`, `… 3`. With no date
 * (something planned, not yet scheduled) it is `Planned Label`. Comparison ignores case because macOS file
 * systems do.
 */
export function datedBaseName(
  date: string,
  label: string,
  taken: Iterable<string>,
  { fallback, maxLength }: { fallback: string; maxLength: number }
): string {
  const used = new Set([...taken].map((n) => n.toLowerCase()))
  const stem = `${date || 'Planned'} ${safeNamePart(label, fallback, maxLength)}`
  if (!used.has(stem.toLowerCase())) return stem
  for (let n = 2; ; n++) {
    const candidate = `${stem} ${n}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
}

/** The date a file name starts with (`YYYY-MM-DD `), if any. Not validated as a real date. */
export function dateFromBaseName(baseName: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})(?:\s|$)/.exec(baseName)
  return m ? m[1] : null
}

/** An id (base name) that can safely become a path inside a notes folder. */
export function isSafeNoteId(id: string): boolean {
  return (
    id.length > 0 &&
    id.length <= 200 &&
    id === id.trim() &&
    basename(id) === id &&
    !id.startsWith('.') &&
    !id.endsWith('.md') &&
    // eslint-disable-next-line no-control-regex
    !/[\\/:*?"<>|\u0000-\u001f]/.test(id)
  )
}

/** The file for a note id inside `dir`; `what` names the kind of note in the error ("meeting", "training entry"). */
export function notePath(dir: string, id: string, what = 'note'): string {
  if (!isSafeNoteId(id)) throw new Error(`Invalid ${what} id: ${id}`)
  return join(dir, `${id}.md`)
}

/** The id of a note file name (`x.md` gives `x`), or null if it is not a note. */
export function idFromNoteFileName(fileName: string): string | null {
  if (!fileName.endsWith('.md') || fileName.startsWith('.')) return null
  const id = fileName.slice(0, -3)
  return isSafeNoteId(id) ? id : null
}
