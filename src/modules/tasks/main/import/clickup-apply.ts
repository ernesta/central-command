import type { Database } from 'better-sqlite3'
import { countAllTasks } from '../repository'
import { TasksStore, type Clock } from '../tasks-store'
import type { ImportPlan } from './clickup-import'

export class StoreNotEmptyError extends Error {}

/**
 * Write a plan into the database in one transaction: top-level tasks first, then subtasks under them. Never adds to a
 * store that already holds tasks (the trash counts). Before the transaction commits the rows are read back and compared
 * with the plan (tasks, per status, minutes, subtasks); a difference rolls everything back.
 */
export function applyClickupPlan(
  db: Database,
  plan: ImportPlan,
  clock?: Clock
): { created: number } {
  return db.transaction(() => {
    if (countAllTasks(db) > 0) {
      throw new StoreNotEmptyError('The store already holds tasks; the import never adds to it.')
    }
    const store = new TasksStore(db, clock)
    const uidOf = new Map<string, string>()
    for (const t of plan.tasks.filter((p) => p.parentSourceId === null)) {
      uidOf.set(t.sourceId, store.create(t.input).uid)
    }
    for (const t of plan.tasks.filter((p) => p.parentSourceId !== null)) {
      const parentUid = uidOf.get(t.parentSourceId as string)
      if (!parentUid) throw new Error(`The parent of ${t.sourceId} was not created`)
      uidOf.set(t.sourceId, store.create({ ...t.input, parentUid }).uid)
    }
    verify(db, plan)
    return { created: uidOf.size }
  })()
}

function verify(db: Database, plan: ImportPlan): void {
  const r = plan.report
  const count = (sql: string): number => (db.prepare(sql).get() as { n: number }).n
  const problems: string[] = []
  const total = count('SELECT COUNT(*) AS n FROM tasks')
  if (total !== r.planned) problems.push(`${total} rows written, ${r.planned} planned`)
  for (const s of ['todo', 'doing', 'done'] as const) {
    const n = count(`SELECT COUNT(*) AS n FROM tasks WHERE status = '${s}'`)
    if (n !== r.byStatus[s]) problems.push(`status ${s}: ${n} written, ${r.byStatus[s]} planned`)
  }
  const minutes = count('SELECT COALESCE(SUM(earlier_minutes), 0) AS n FROM tasks')
  if (minutes !== r.totalMinutes) problems.push(`${minutes} min written, ${r.totalMinutes} planned`)
  const subs = count('SELECT COUNT(*) AS n FROM tasks WHERE parent_uid IS NOT NULL')
  if (subs !== r.subtasks) problems.push(`${subs} subtasks written, ${r.subtasks} planned`)
  const orphans = count(
    'SELECT COUNT(*) AS n FROM tasks c WHERE c.parent_uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tasks p WHERE p.uid = c.parent_uid)'
  )
  if (orphans > 0) problems.push(`${orphans} subtasks without a parent`)
  if (problems.length > 0)
    throw new Error(`The import did not read back as planned: ${problems.join('; ')}`)
}
