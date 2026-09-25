import { readdir } from 'fs/promises'
import { join } from 'path'
import { writeFileAtomic } from '../atomic-write'
import { readNoteFile, writeNoteFileGuarded } from './guarded-file'

interface RewriteOptions {
  /** The folder holding the notes (Markdown files, not in sub-folders). A missing folder has no notes. */
  dir: string
  /** The new text of a note; the same text when nothing about it changes. */
  transform: (content: string) => string
  /** Where the original of every changed note is copied first. */
  backupDir: string
}

/** The file names of the notes that were changed, and of those skipped because they changed meanwhile. */
export interface RewriteResult {
  changed: string[]
  skipped: string[]
}

/**
 * Rewrite the notes in a folder. Each changed note is first copied to `backupDir`, then saved with the
 * same content-hash guard as the editor: a note that changed since it was read is skipped and reported,
 * never overwritten. Notes that would come out identical are not written at all.
 */
export async function rewriteNoteFiles({
  dir,
  transform,
  backupDir
}: RewriteOptions): Promise<RewriteResult> {
  let names: string[]
  try {
    names = (await readdir(dir)).filter((f) => f.endsWith('.md') && !f.startsWith('.')).sort()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { changed: [], skipped: [] }
    throw error
  }
  const report: RewriteResult = { changed: [], skipped: [] }
  for (const name of names) {
    const path = join(dir, name)
    const note = await readNoteFile(path)
    if (!note.exists) continue
    const next = transform(note.content)
    if (next === note.content) continue
    await writeFileAtomic(join(backupDir, name), note.content)
    const { result, wrote } = await writeNoteFileGuarded(path, next, note.hash)
    if (result.status === 'conflict') report.skipped.push(name)
    else if (wrote) report.changed.push(name)
  }
  return report
}
