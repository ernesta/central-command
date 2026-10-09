import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import type { Database } from 'better-sqlite3'
import { findMentions } from '@shared/entities'
import type { BacklinkFolder } from './backlinks'

/**
 * Every citekey `@` mentioned anywhere — `cc://reading/<citekey>` in a note, meeting, training
 * entry, reading list, training plan or task description — as one set built in a single pass.
 * `findBacklinks` reads every file per call, which is fine once for an on-demand "Mentioned in"
 * panel but too slow to call per citekey inside a sync; this builds the set once and callers test
 * membership against it.
 */
export async function collectMentionedReadingKeys(
  db: Database,
  folders: readonly BacklinkFolder[]
): Promise<Set<string>> {
  const found = new Set<string>()
  for (const folder of folders) {
    let names: string[]
    try {
      names = (await readdir(folder.dir)).filter((f) => f.endsWith('.md') && !f.startsWith('.'))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
    for (const name of names) {
      const content = await readFile(join(folder.dir, name), 'utf8')
      for (const mention of findMentions(content)) {
        if (mention.ref.kind === 'reading') found.add(mention.ref.key)
      }
    }
  }

  const tasks = db
    .prepare(
      `SELECT description FROM tasks WHERE deleted_at IS NULL AND description LIKE '%cc://%'`
    )
    .all() as { description: string }[]
  for (const row of tasks) {
    for (const mention of findMentions(row.description)) {
      if (mention.ref.kind === 'reading') found.add(mention.ref.key)
    }
  }

  return found
}
