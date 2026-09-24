import { createHash } from 'crypto'
import { readFile } from 'fs/promises'
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
