import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Database } from 'better-sqlite3'
import { listTasks, listTrash } from './repository'
import { TASK_WORKSPACES } from '../shared/types'

/** How many snapshots are kept; older ones are removed when a new one is written. */
export const SNAPSHOTS_KEPT = 14

const PREFIX = 'tasks-'

/**
 * A readable copy of every task (and the trash) as JSON in `dir`, so the tasks are never only inside the database. One
 * per call, named by the moment it was taken; the oldest beyond `SNAPSHOTS_KEPT` go. Returns the file written.
 */
export function writeTasksSnapshot(
  db: Database,
  dir: string,
  at: Date = new Date(),
  label = ''
): string {
  mkdirSync(dir, { recursive: true })
  const stamp = at.toISOString().replace(/[:.]/g, '-')
  const file = join(dir, `${PREFIX}${stamp}${label ? `-${label}` : ''}.json`)
  const snapshot = {
    taken: at.toISOString(),
    tasks: TASK_WORKSPACES.flatMap((w) => listTasks(db, w)),
    trash: listTrash(db)
  }
  writeFileSync(file, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' })
  const old = readdirSync(dir)
    .filter((f) => f.startsWith(PREFIX) && f.endsWith('.json'))
    .sort()
    .slice(0, -SNAPSHOTS_KEPT)
  for (const f of old) rmSync(join(dir, f), { force: true })
  return file
}
