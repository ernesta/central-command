import type { Database } from 'better-sqlite3'
import { join } from 'path'
import { renameFileMentions } from '@shared/entities'
import { rewriteNoteFiles } from '../notes/rewrite-files'
import type { BacklinkFolder } from './backlinks'

/**
 * Point every mention of a file at its new key: in each folder of notes (copied to `backupDir` first, saved with the
 * usual hash guard, a note that changed meanwhile is skipped) and in the descriptions of tasks. Returns how many
 * notes and tasks were changed.
 */
export async function moveFileMentions(options: {
  folders: readonly BacklinkFolder[]
  db: Database
  backupDir: string
  from: string
  to: string
  now?: () => string
}): Promise<number> {
  const { folders, db, backupDir, from, to, now = () => new Date().toISOString() } = options
  let changed = 0
  for (const [i, folder] of folders.entries()) {
    const result = await rewriteNoteFiles({
      dir: folder.dir,
      backupDir: join(backupDir, String(i)),
      transform: (content) => renameFileMentions(content, from, to)
    })
    changed += result.changed.length
  }
  const rows = db
    .prepare(
      `SELECT uid, description FROM tasks WHERE deleted_at IS NULL AND description LIKE '%cc://file/%'`
    )
    .all() as { uid: string; description: string }[]
  const update = db.prepare('UPDATE tasks SET description = ?, updated_at = ? WHERE uid = ?')
  for (const row of rows) {
    const next = renameFileMentions(row.description, from, to)
    if (next === row.description) continue
    update.run(next, now(), row.uid)
    changed += 1
  }
  return changed
}
