/**
 * Watch's stored items against the rules the checker now uses (a page source stores only what has a coming date, no credits, nothing
 * about past events). Lists, source by source, what stays and what would go.
 *
 *   npm run watch:reparse
 *   npm run watch:reparse -- --apply   # app closed; backs the database up first
 *
 * Dry run by default: a throwaway copy of the database gets Watch's newer migrations and is judged; your database is not touched.
 * `--apply` removes the unsaved items that fail the rules (never a saved item) and makes each page source read afresh at its next
 * check (its validators, page hash and remembered way are cleared). Your sources (names, addresses, kinds) are never changed, and
 * nothing is fetched: the app checks the sources once it runs.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { openDatabase } from '../src/main/db/connection'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { runMigrations } from '../src/main/db/migrate'
import { watchMigrationsFromDir } from '../src/modules/watch/main/migration-files'
import { applyReparse, planReparse } from '../src/modules/watch/main/reparse'

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
const migrations = watchMigrationsFromDir(join(process.cwd(), 'src/modules/watch/main/migrations'))
const today = new Date().toISOString().slice(0, 10)

const scratch = mkdtempSync(join(tmpdir(), 'cc-reparse-'))
const copyFile = join(scratch, 'copy.sqlite')
const reader = new Database(databaseFile, { readonly: true })
reader.prepare('VACUUM INTO ?').run(copyFile)
reader.close()
const copy = new Database(copyFile)
let plan
try {
  runMigrations(copy, migrations)
  plan = planReparse(copy, today)
} finally {
  copy.close()
  rmSync(scratch, { recursive: true, force: true })
}

let go = 0
let stay = 0
for (const source of plan) {
  const removed = source.items.filter((p) => p.remove)
  const kept = source.items.filter((p) => !p.remove)
  go += removed.length
  stay += kept.length
  console.log(`\n${source.title}  (${source.method})\n  ${source.url}`)
  console.log(
    `  ${removed.length} to remove, ${kept.length} to keep, ${source.saved} saved (never touched)`
  )
  for (const p of removed) console.log(`    - ${p.item.title.slice(0, 90)}  [${p.remove}]`)
  for (const p of kept) console.log(`    + ${p.item.title.slice(0, 90)}`)
}
console.log(
  `\n${go} unsaved item(s) to remove, ${stay} to keep, in ${plan.length} page source(s). Today is ${today}.`
)

if (!apply) {
  console.log(
    '\nDry run: nothing changed. Add --apply (app closed) to remove them and make the sources read afresh.'
  )
  process.exit(0)
}

const backups = join(
  root,
  'backups',
  `watch-reparse-${new Date().toISOString().replace(/[:.]/g, '-')}`
)
mkdirSync(backups, { recursive: true })
cpSync(databaseFile, join(backups, 'central-command.sqlite'))
const db = openDatabase(databaseFile)
try {
  runMigrations(db, migrations)
  const removed = applyReparse(db, planReparse(db, today))
  console.log(`\nRemoved ${removed} item(s). Backup: ${backups}`)
} finally {
  db.close()
}
