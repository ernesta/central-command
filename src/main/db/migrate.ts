import type { Database } from 'better-sqlite3'

export interface Migration {
  /** Globally unique and sortable, e.g. 'readings/0001_init'. Never rename once shipped. */
  id: string
  sql: string
}

/**
 * Apply any migrations not yet recorded in schema_migrations, in id order.
 * Each runs in its own transaction, so a failure leaves the database at the
 * last good migration. Returns the ids applied by this call.
 */
export function runMigrations(db: Database, migrations: readonly Migration[]): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `)

  const ids = migrations.map((m) => m.id)
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i)
  if (duplicate) throw new Error(`Duplicate migration id: ${duplicate}`)

  const applied = new Set(
    db
      .prepare('SELECT id FROM schema_migrations')
      .all()
      .map((row) => (row as { id: string }).id)
  )
  const record = db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)')
  const ran: string[] = []

  for (const migration of [...migrations].sort((a, b) => a.id.localeCompare(b.id))) {
    if (applied.has(migration.id)) continue
    db.transaction(() => {
      db.exec(migration.sql)
      record.run(migration.id, new Date().toISOString())
    })()
    ran.push(migration.id)
  }
  return ran
}
