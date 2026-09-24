import { join } from 'path'

const MAX_NAME_LENGTH = 200

/**
 * The filename (without extension) for a reading's notes: the citekey, made safe for any
 * filesystem. Better BibTeX citekeys are normally plain letters and digits, so this is
 * usually the identity; it exists so an odd citekey can never escape the notes folder.
 */
export function noteBaseName(citekey: string): string {
  const cleaned = citekey
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .trim()
    .replace(/^\.+/, '_')
    .slice(0, MAX_NAME_LENGTH)
  return cleaned || '_'
}

export function noteFileName(citekey: string): string {
  return `${noteBaseName(citekey)}.md`
}

export function notePath(notesDir: string, citekey: string): string {
  return join(notesDir, noteFileName(citekey))
}
