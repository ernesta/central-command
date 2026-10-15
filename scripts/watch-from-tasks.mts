/**
 * The addresses in your "Check upcoming …" reminders (what you open by hand every month), as sources for Watch.
 * Dry run by default: the database is opened read-only and the app's pages are not fetched. Lists what would be watched,
 * what you must keep checking by hand (a login, a shared folder) and the places named without an address.
 *
 *   npm run watch:from-tasks
 *   npm run watch:from-tasks -- --apply   # app closed; backs up the database first, then adds the sources (and Watch's tables)
 *
 * Nothing is fetched here either way; the app checks the sources once it runs.
 */
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { openDatabase } from '../src/main/db/connection'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { runMigrations } from '../src/main/db/migrate'
import { sourcesFromTasks } from '../src/modules/watch/main/from-tasks'
import { watchMigrationsFromDir } from '../src/modules/watch/main/migration-files'
import { addSource, listSources } from '../src/modules/watch/main/repository'

const apply = process.argv.includes('--apply')
const root = join(
  assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir()),
  'CentralCommand'
)
const databaseFile = join(root, 'data', 'central-command.sqlite')
if (!existsSync(databaseFile)) {
  console.error(`No library under ${root}`)
  process.exit(1)
}

const reader = new Database(databaseFile, { readonly: true })
const tasks = reader
  .prepare(
    `SELECT uid, title, description FROM tasks
     WHERE deleted_at IS NULL AND parent_uid IS NULL AND status != 'done' AND title LIKE 'Check upcoming%'`
  )
  .all() as { uid: string; title: string; description: string }[]
reader.close()

const found = sourcesFromTasks(tasks)
console.log(`${tasks.length} open "Check upcoming …" reminder(s) read.\n`)
for (const label of [...new Set(found.sources.map((s) => s.groupLabel))]) {
  console.log(label)
  for (const s of found.sources.filter((x) => x.groupLabel === label))
    console.log(`  + ${s.title}  (${s.kind}, page)\n      ${s.url}`)
}
if (found.byHand.length > 0) {
  console.log('\nKeep checking by hand (the app cannot open these):')
  for (const b of found.byHand) console.log(`  - ${b.line}\n      ${b.reason}  [${b.taskTitle}]`)
}
if (found.noAddress.length > 0) {
  console.log('\nNamed without an address (give one to watch it):')
  for (const n of found.noAddress) console.log(`  - ${n.line}  [${n.taskTitle}]`)
}

if (!apply) {
  console.log('\nDry run: nothing changed. Add --apply (app closed) to add these sources.')
  process.exit(0)
}

const backups = join(root, 'backups', `watch-${new Date().toISOString().replace(/[:.]/g, '-')}`)
mkdirSync(backups, { recursive: true })
copyFileSync(databaseFile, join(backups, 'central-command.sqlite'))
const db = openDatabase(databaseFile)
try {
  runMigrations(
    db,
    watchMigrationsFromDir(join(process.cwd(), 'src/modules/watch/main/migrations'))
  )
  const have = new Set(listSources(db).map((s) => s.url))
  let added = 0
  for (const s of found.sources) {
    if (have.has(s.url)) continue
    addSource(db, s, new Date().toISOString())
    added++
  }
  console.log(
    `\nAdded ${added} source(s); ${found.sources.length - added} were already there. Backup: ${backups}`
  )
} finally {
  db.close()
}
