import { realpath, readdir, stat } from 'fs/promises'
import { isAbsolute, join, sep } from 'path'

/** A refused request: an unsafe name, a path outside the linked folder, a file that will not be opened. */
export class FilesError extends Error {}

/** The folder or file is not there (moved, renamed or deleted); the message is fit to show. */
export class NotThereError extends FilesError {}

const hasControl = (text: string): boolean =>
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u001f]/.test(text)

const hasDotDot = (text: string): boolean => text.split(/[\\/]/).some((part) => part === '..')

/** A path below a linked folder (a sub-folder or a file name): no leading slash, no `..` and no control characters. */
export function isSafeRelativeFolder(folder: string): boolean {
  return (
    folder !== '' &&
    !folder.startsWith('/') &&
    !folder.startsWith('~') &&
    !hasControl(folder) &&
    !hasDotDot(folder)
  )
}

/**
 * A linked folder as an entry stores it: an absolute path. No `..` and no control characters.
 */
export function isSafeFolder(folder: string): boolean {
  return folder !== '' && !folder.startsWith('~') && !hasControl(folder) && !hasDotDot(folder)
}

/** Extensions the app never opens: they run code rather than show a file. */
const NEVER_OPEN = new Set([
  'app',
  'command',
  'sh',
  'zsh',
  'bash',
  'scpt',
  'workflow',
  'pkg',
  'dmg',
  'exe',
  'bat',
  'jar',
  'terminal',
  'webloc',
  'url'
])

export interface FolderEntry {
  name: string
  kind: 'file' | 'folder'
  /** Bytes, for files. */
  size: number | null
}

export type FolderListing =
  | { status: 'ok'; entries: FolderEntry[] }
  /** The entry's folder is not there (moved or renamed). */
  | { status: 'missing' }

const inside = (root: string, target: string): boolean =>
  target === root || target.startsWith(root.endsWith(sep) ? root : root + sep)

const notThere = (name: string | undefined): NotThereError =>
  new NotThereError(`“${name}” is not there. It may have been moved or renamed.`)

/** A linked folder is an absolute path; anything else (an old relative link nothing resolves any more) is not there. */
export function folderPath(folder: string): string {
  if (!isSafeFolder(folder)) throw new FilesError(`Not a usable folder: ${folder}`)
  if (!isAbsolute(folder)) throw notThere(folder.split('/').at(-1))
  return folder
}

/**
 * The real path of `sub/name` in the linked `folder` (the folder itself when both are empty), or an
 * error. Symbolic links are followed before the check, so a link that leads out of the folder is refused
 * like `..` is. The app never writes anywhere: everything here only reads, lists, opens or reveals.
 */
export async function resolveInside(folder: string, sub = '', name = ''): Promise<string> {
  const base = folderPath(folder)
  const parts = [sub, name].filter((p) => p !== '')
  for (const part of parts) {
    if (!isSafeRelativeFolder(part)) throw new FilesError(`Not a path inside the folder: ${part}`)
  }
  let baseReal: string
  try {
    baseReal = await realpath(base)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw notThere(base.split(sep).at(-1))
    throw error
  }
  let real: string
  try {
    real = await realpath(join(baseReal, ...parts))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      throw notThere(parts.join('/').split('/').at(-1))
    throw error
  }
  if (!inside(baseReal, real)) throw new FilesError('That path is outside the linked folder')
  return real
}

/** One level of an entry's folder (or of a sub-folder), folders first. Hidden files, Office lock files and links that lead out of the folder are left out. */
export async function listFolder(folder: string, sub = ''): Promise<FolderListing> {
  let linked: string
  let dir: string
  try {
    linked = await resolveInside(folder)
    dir = sub === '' ? linked : await resolveInside(folder, sub)
    if (!(await stat(dir)).isDirectory()) return { status: 'missing' }
  } catch (error) {
    if (error instanceof FilesError && !(error instanceof NotThereError)) throw error
    return { status: 'missing' }
  }
  const entries: FolderEntry[] = []
  for (const dirent of await readdir(dir, { withFileTypes: true })) {
    // Hidden files and Office's temporary lock files (`~$name.docx`).
    if (dirent.name.startsWith('.') || dirent.name.startsWith('~$')) continue
    try {
      const real = await realpath(join(dir, dirent.name))
      if (!inside(linked, real)) continue
      const info = await stat(real)
      if (info.isDirectory()) entries.push({ name: dirent.name, kind: 'folder', size: null })
      else if (info.isFile()) entries.push({ name: dirent.name, kind: 'file', size: info.size })
    } catch {
      // A broken link or a file that vanished: not listed.
    }
  }
  entries.sort(
    (a, b) => (a.kind === b.kind ? 0 : a.kind === 'folder' ? -1 : 1) || a.name.localeCompare(b.name)
  )
  return { status: 'ok', entries }
}

/** The real path of a file that may be opened with the default app: a regular file, not one that runs code. */
export async function openablePath(folder: string, sub: string, name: string): Promise<string> {
  const real = await resolveInside(folder, sub, name)
  if (!(await stat(real)).isFile()) throw new FilesError('Only files can be opened')
  const extension = real.split('.').pop()?.toLowerCase() ?? ''
  if (NEVER_OPEN.has(extension))
    throw new FilesError(`Files of this kind are not opened: .${extension}`)
  return real
}
