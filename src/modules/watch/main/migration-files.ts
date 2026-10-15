import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import type { Migration } from '../../../main/db/migrate'

/** The module's migrations read from its `migrations/` folder, for scripts that run outside Vite (which has `?raw`). */
export function watchMigrationsFromDir(dir: string): Migration[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({
      id: `watch/${f.replace(/\.sql$/, '')}`,
      sql: readFileSync(join(dir, f), 'utf8')
    }))
}
