import { realpath, readdir, stat } from 'fs/promises'
import { isAbsolute, join, relative, sep } from 'path'

/** A refused request: a path outside the Trainings folder, an unsafe name, a file that will not be opened. */
export class FilesError extends Error {}

/** A relative path inside the Trainings folder: no leading slash, no `..` and no control characters. */
export function isSafeRelativeFolder(folder: string): boolean {
  return (
    folder !== '' &&
    !folder.startsWith('/') &&
    !folder.startsWith('~') &&
    // eslint-disable-next-line no-control-regex
    !/[\u0000-\u001f]/.test(folder) &&
    !folder.split(/[\\/]/).some((part) => part === '..')
  )
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
  /** The Trainings folder setting is empty or is not a folder. */
  | { status: 'no-root' }
  /** The entry's folder is not there (moved or renamed). */
  | { status: 'missing' }

const inside = (root: string, target: string): boolean =>
  target === root || target.startsWith(root.endsWith(sep) ? root : root + sep)

/**
 * The real path of `folder/sub/name` under the Trainings folder `root`, or an error. Symbolic links are
 * followed before the check, so a link that leads outside the root is refused like `..` is. The app
 * never writes anywhere: everything here only reads, lists, opens or reveals.
 */
export async function resolveInside(
  root: string,
  folder: string,
  sub = '',
  name = ''
): Promise<string> {
  if (!root || !isAbsolute(root)) throw new FilesError('The Trainings folder is not set')
  const parts = [folder, sub, name].filter((p) => p !== '')
  for (const part of parts) {
    if (!isSafeRelativeFolder(part))
      throw new FilesError(`Not a path inside the Trainings folder: ${part}`)
  }
  let rootReal: string
  try {
    rootReal = await realpath(root)
  } catch {
    throw new FilesError('The Trainings folder is not there')
  }
  const real = await realpath(join(rootReal, ...parts))
  if (!inside(rootReal, real)) throw new FilesError('That path is outside the Trainings folder')
  return real
}

/** One level of an entry's folder (or of a sub-folder), folders first. Hidden files and links that lead outside the root are left out. */
export async function listFolder(root: string, folder: string, sub = ''): Promise<FolderListing> {
  if (!root || !isAbsolute(root)) return { status: 'no-root' }
  try {
    if (!(await stat(root)).isDirectory()) return { status: 'no-root' }
  } catch {
    return { status: 'no-root' }
  }
  let dir: string
  try {
    dir = await resolveInside(root, folder, sub)
    if (!(await stat(dir)).isDirectory()) return { status: 'missing' }
  } catch (error) {
    if (error instanceof FilesError) throw error
    return { status: 'missing' }
  }
  const rootReal = await realpath(root)
  const entries: FolderEntry[] = []
  for (const dirent of await readdir(dir, { withFileTypes: true })) {
    if (dirent.name.startsWith('.')) continue
    try {
      const real = await realpath(join(dir, dirent.name))
      if (!inside(rootReal, real)) continue
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
export async function openablePath(
  root: string,
  folder: string,
  sub: string,
  name: string
): Promise<string> {
  const real = await resolveInside(root, folder, sub, name)
  if (!(await stat(real)).isFile()) throw new FilesError('Only files can be opened')
  const extension = real.split('.').pop()?.toLowerCase() ?? ''
  if (NEVER_OPEN.has(extension))
    throw new FilesError(`Files of this kind are not opened: .${extension}`)
  return real
}

/** An absolute path picked in a dialog as a path relative to the Trainings folder; refuses one outside it. */
export async function relativeToRoot(root: string, absolute: string): Promise<string> {
  if (!root || !isAbsolute(root)) throw new FilesError('Set the Trainings folder in Settings first')
  if (!isAbsolute(absolute)) throw new FilesError('Not an absolute path')
  const [rootReal, real] = await Promise.all([realpath(root), realpath(absolute)])
  if (!inside(rootReal, real)) throw new FilesError('Choose a folder inside the Trainings folder')
  const rel = relative(rootReal, real).split(sep).join('/')
  if (rel === '')
    throw new FilesError('Choose a folder inside the Trainings folder, not the folder itself')
  return rel
}
