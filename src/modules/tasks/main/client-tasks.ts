import type { Database } from 'better-sqlite3'
import type { ClientTasks } from '../../../main/tracking/store'

/**
 * A Work client's Tasks list, for the tracking store (`docs/CLIENT_LISTS_PLAN.md`, stage 2). A list exists because tasks
 * name it: a client with no task has no row, just its name being allowed (`work-lists.ts`). Top-level tasks only (a
 * subtask has no list), the Trash included, so a task restored later still has its list; names compared ignoring case.
 */
export function createClientTasks(db: Database, moved: () => void = () => {}): ClientTasks {
  return {
    count(client) {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS n FROM tasks
           WHERE workspace = 'work' AND parent_uid IS NULL AND lower(list) = lower(?)`
        )
        .get(client) as { n: number }
      return row.n
    },
    rename(from, to) {
      const result = db
        .prepare(
          `UPDATE tasks SET list = ?
           WHERE workspace = 'work' AND parent_uid IS NULL AND lower(list) = lower(?)`
        )
        .run(to, from)
      if (result.changes > 0) moved()
    }
  }
}
