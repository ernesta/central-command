import { basename, join } from 'path'

const MAX_SERIES_LENGTH = 60

/** A series name made safe to use inside a file name. */
function safeSeries(series: string): string {
  const cleaned = series
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '_')
    .slice(0, MAX_SERIES_LENGTH)
    .trim()
  return cleaned || 'Other'
}

/**
 * The base name (no extension) for a new meeting: `YYYY-MM-DD Series`, and `YYYY-MM-DD Series 2`,
 * `… 3` for further meetings of the same series on the same day. `taken` holds the base names
 * already in use; comparison ignores case because macOS file systems do.
 */
export function meetingBaseName(date: string, series: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((n) => n.toLowerCase()))
  const stem = `${date} ${safeSeries(series)}`
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

/** A meeting id (base name) that can safely become a path inside the meetings folder. */
export function isSafeMeetingId(id: string): boolean {
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

export function meetingPath(dir: string, id: string): string {
  if (!isSafeMeetingId(id)) throw new Error(`Invalid meeting id: ${id}`)
  return join(dir, `${id}.md`)
}

/** The id of a meeting file name (`x.md` gives `x`), or null if it is not a meeting note. */
export function idFromFileName(fileName: string): string | null {
  if (!fileName.endsWith('.md') || fileName.startsWith('.')) return null
  const id = fileName.slice(0, -3)
  return isSafeMeetingId(id) ? id : null
}
