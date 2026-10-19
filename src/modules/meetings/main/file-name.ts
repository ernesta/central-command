import {
  dateFromBaseName,
  datedBaseName,
  idFromNoteFileName,
  isSafeNoteId,
  notePath
} from '../../../main/notes/file-name'

const MAX_SERIES_LENGTH = 60

/**
 * The base name (no extension) for a new meeting: `YYYY-MM-DD Series`, and `YYYY-MM-DD Series 2`,
 * `… 3` for further meetings of the same series on the same day. `taken` holds the base names
 * already in use; comparison ignores case because macOS file systems do.
 */
export function meetingBaseName(date: string, series: string, taken: Iterable<string>): string {
  return datedBaseName(date, series.trim() === '' ? UNTITLED : series, taken, {
    fallback: 'Other',
    maxLength: MAX_SERIES_LENGTH
  })
}

/** What a meeting with no series is filed as: `YYYY-MM-DD Untitled`, `… Untitled 2` for repeats. */
export const UNTITLED = 'Untitled'

/** A name this module gave a meeting with no series (`2026-10-19 Untitled`, `Planned Untitled 2`), which a new series may rename. */
export const isUntitledName = (id: string): boolean =>
  /^(?:\d{4}-\d{2}-\d{2}|Planned) Untitled(?: \d+)?$/.test(id)

export { dateFromBaseName }

/** A meeting id (base name) that can safely become a path inside the meetings folder. */
export const isSafeMeetingId = isSafeNoteId

export const meetingPath = (dir: string, id: string): string => notePath(dir, id, 'meeting')

/** The id of a meeting file name (`x.md` gives `x`), or null if it is not a meeting note. */
export const idFromFileName = idFromNoteFileName
