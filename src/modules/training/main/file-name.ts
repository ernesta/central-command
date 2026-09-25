import {
  dateFromBaseName,
  datedBaseName,
  idFromNoteFileName,
  notePath
} from '../../../main/notes/file-name'

const MAX_TITLE_LENGTH = 80

/**
 * The base name (no extension) for an entry: `YYYY-MM-DD Title`, and `… 2`, `… 3` when the same date
 * and title are taken. Characters that are unsafe in a file name (the colon in `SEDarc: …`) become `_`.
 */
export function trainingBaseName(date: string, title: string, taken: Iterable<string>): string {
  return datedBaseName(date, title, taken, { fallback: 'Untitled', maxLength: MAX_TITLE_LENGTH })
}

export { dateFromBaseName }

export const trainingPath = (dir: string, id: string): string => notePath(dir, id, 'training entry')

/** The id of an entry file name (`x.md` gives `x`), or null if it is not a note. */
export const idFromFileName = idFromNoteFileName
