import {
  dateFromBaseName,
  datedBaseName,
  idFromNoteFileName,
  notePath
} from '../../../main/notes/file-name'

const MAX_NAME_LENGTH = 120

/**
 * The base name (no extension) for an entry: `YYYY-MM-DD Series - Title` (just `YYYY-MM-DD Title` with no
 * series), and `… 2`, `… 3` when that is taken. The series is in the name so files can be found by it.
 * Characters that are unsafe in a file name (a colon in a title) become `_`.
 */
export function trainingBaseName(
  date: string,
  title: string,
  series: string | null | undefined,
  taken: Iterable<string>
): string {
  const label =
    series?.trim() && title.trim() ? `${series.trim()} - ${title.trim()}` : title || series || ''
  return datedBaseName(date, label, taken, { fallback: 'Untitled', maxLength: MAX_NAME_LENGTH })
}

export { dateFromBaseName }

export const trainingPath = (dir: string, id: string): string => notePath(dir, id, 'training entry')

/** The id of an entry file name (`x.md` gives `x`), or null if it is not a note. */
export const idFromFileName = idFromNoteFileName
