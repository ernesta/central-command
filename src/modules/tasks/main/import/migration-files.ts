import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import type { Migration } from '../../../../main/db/migrate'

/** The module's migrations read from its `migrations/` folder, for scripts that run outside Vite (which has `?raw`). */
export function tasksMigrationsFromDir(dir: string): Migration[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({
      id: `tasks/${f.replace(/\.sql$/, '')}`,
      sql: readFileSync(join(dir, f), 'utf8')
    }))
}
