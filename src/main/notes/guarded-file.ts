import { createHash, randomUUID } from 'crypto'
import { link, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { basename, dirname, join } from 'path'
import type { NoteContent, NoteWriteResult } from '@shared/notes'
import { writeFileAtomic } from '../atomic-write'

export function hashContent(content: string): string {
  return createHash('sha1').update(content, 'utf8').digest('hex')
}

/** Read a notes file. A missing file reads as an empty one (`exists: false`). */
export async function readNoteFile(path: string): Promise<NoteContent> {
  try {
    const content = await readFile(path, 'utf8')
    return { exists: true, content, hash: hashContent(content) }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { exists: false, content: '', hash: hashContent('') }
    }
    throw error
  }
}

export interface GuardedWrite {
  result: NoteWriteResult
  /** True only when the file on disk was actually created or changed. */
  wrote: boolean
}

/**
 * Save `content` to `path`, provided the file on disk still matches `baseHash` (what the editor
 * loaded or last saved). A missing file and an empty file hash the same.
 * - Nothing is written when the disk already holds `content`.
 * - If the file changed since `baseHash`, nothing is written and the disk version is returned.
 * - The file is created lazily: whitespace-only content never creates one.
 * - Clearing a note leaves an empty file rather than deleting it.
 * - The write itself is atomic (temp file plus rename).
 */
export async function writeNoteFileGuarded(
  path: string,
  content: string,
  baseHash: string
): Promise<GuardedWrite> {
  const disk = await readNoteFile(path)
  if (disk.content === content)
    return { result: { status: 'saved', hash: disk.hash }, wrote: false }
  if (disk.hash !== baseHash) return { result: { status: 'conflict', disk }, wrote: false }

  if (content.trim() === '' && !disk.exists) {
    return { result: { status: 'saved', hash: hashContent('') }, wrote: false }
  }

  await writeFileAtomic(path, content)
  return { result: { status: 'saved', hash: hashContent(content) }, wrote: true }
}

/**
 * Rename `from` to `to` without ever replacing a file that is already at `to`: the new name is linked
 * to the old file, then the old name is removed. Returns false (changing nothing) if `to` exists.
 */
export async function renameNoteFileExclusive(from: string, to: string): Promise<boolean> {
  try {
    await link(from, to)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'EEXIST') return false
    if (code !== 'EPERM' && code !== 'ENOTSUP' && code !== 'EXDEV') throw error
    // No hard links here: copy exclusively, then remove the original.
    const content = await readFile(from)
    try {
      await writeFile(to, content, { flag: 'wx' })
    } catch (inner) {
      if ((inner as NodeJS.ErrnoException).code === 'EEXIST') return false
      throw inner
    }
  }
  await rm(from)
  return true
}

/**
 * Create `path` with `content`, but only if nothing is there yet. Returns false (writing nothing) if
 * the file already exists. The content is written to a temp file first and then linked into place,
 * so the new file appears complete and an existing file can never be replaced.
 */
export async function createNoteFileExclusive(path: string, content: string): Promise<boolean> {
  const dir = dirname(path)
  await mkdir(dir, { recursive: true })
  const tmp = join(dir, `.${basename(path)}.${randomUUID()}.tmp`)
  try {
    await writeFile(tmp, content, { encoding: 'utf8', flag: 'wx' })
    try {
      await link(tmp, path)
      return true
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'EEXIST') return false
      // File systems without hard links: fall back to an exclusive create.
      if (code !== 'EPERM' && code !== 'ENOTSUP' && code !== 'EXDEV') throw error
      try {
        await writeFile(path, content, { encoding: 'utf8', flag: 'wx' })
        return true
      } catch (inner) {
        if ((inner as NodeJS.ErrnoException).code === 'EEXIST') return false
        throw inner
      }
    }
  } finally {
    await rm(tmp, { force: true })
  }
}
