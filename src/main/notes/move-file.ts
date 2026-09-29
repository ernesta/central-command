import { rm, stat, utimes } from 'fs/promises'
import { createNoteFileExclusive } from './guarded-file'

interface MoveOptions {
  /** The file being moved, and what it holds (what the new file is created with). */
  sourcePath: string
  content: string
  /** A free name in the target folder, tried again with a fresh answer if another file took it meanwhile. */
  pickTarget: () => Promise<{ id: string; path: string }>
  /** Moves a file to the operating system's Trash. */
  trash: (path: string) => Promise<void>
}

/**
 * Move a note file into another folder without ever overwriting or losing it: the new file is created first (exclusively,
 * so an existing file is never replaced), and only then is the original moved to the Trash. If the Trash move fails the new
 * file is removed again (it was made a moment ago, so nothing is lost) and the original is untouched, so a failure never
 * leaves two copies. Returns the id (file name without extension) the note has now.
 */
export async function moveNoteFile({
  sourcePath,
  content,
  pickTarget,
  trash
}: MoveOptions): Promise<string> {
  // "Edited" is the file's modified time, so the copy keeps the original's: a move is not an edit.
  const { atime, mtime } = await stat(sourcePath)
  for (let attempt = 0; attempt < 50; attempt++) {
    const { id, path } = await pickTarget()
    if (!(await createNoteFileExclusive(path, content))) continue
    try {
      await utimes(path, atime, mtime)
      await trash(sourcePath)
    } catch (error) {
      await rm(path, { force: true })
      throw error
    }
    return id
  }
  throw new Error('Could not find a free file name in the other workspace')
}
