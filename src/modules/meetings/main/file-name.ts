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
  return datedBaseName(date, series, taken, { fallback: 'Other', maxLength: MAX_SERIES_LENGTH })
}

export { dateFromBaseName }

/** A meeting id (base name) that can safely become a path inside the meetings folder. */
export const isSafeMeetingId = isSafeNoteId

export const meetingPath = (dir: string, id: string): string => notePath(dir, id, 'meeting')

/** The id of a meeting file name (`x.md` gives `x`), or null if it is not a meeting note. */
export const idFromFileName = idFromNoteFileName
