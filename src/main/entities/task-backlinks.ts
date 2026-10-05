import type { Database } from 'better-sqlite3'
import { findMentions, type Backlink, type EntityRef } from '@shared/entities'
import { contextOf } from './backlinks'

/** Every task whose description mentions `target`, one entry per task, like the note files. A task is not its own mention. */
export function findTaskBacklinks(db: Database, target: EntityRef): Backlink[] {
  const rows = db
    .prepare(
      `SELECT uid, workspace, title, description FROM tasks
       WHERE deleted_at IS NULL AND description LIKE '%cc://%'`
    )
    .all() as { uid: string; workspace: string; title: string; description: string }[]
  const found: Backlink[] = []
  for (const row of rows) {
    if (target.kind === 'task' && target.key === row.uid) continue
    const mention = findMentions(row.description).find(
      (m) => m.ref.kind === target.kind && m.ref.key === target.key
    )
    if (!mention) continue
    found.push({
      source: { kind: 'task', workspace: row.workspace, id: row.uid },
      title: row.title || 'Untitled',
      context: contextOf(row.description, mention.start)
    })
  }
  return found.sort((a, b) => a.title.localeCompare(b.title))
}
