/**
 * One-off (8 Oct 2026): gives PS5210 Applied Neuroscience Methods its series task and three lecture subtasks, links its three notes,
 * and links the first lecture (30 Sep) to the Hours already holding it by splitting that day's total (docs/DECISIONS.md, "PS5210").
 *
 *   npm run link:ps5210              # dry run
 *   npm run link:ps5210 -- --apply   # app closed; backs up the database, the training notes and Research's hours first
 */
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { openDatabase } from '../src/main/db/connection'
import { linkPs5210 } from '../src/modules/training/main/import/ps5210-link'

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
const db = apply ? openDatabase(databaseFile) : new Database(databaseFile, { readonly: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const report = linkPs5210(root, db, apply, stamp)
db.close()
for (const line of report.lines) console.log(line)
if (!report.ok) {
  console.log('\nPROBLEMS: nothing was written.')
  process.exit(1)
}
if (report.backup) console.log(`\nBacked up to ${report.backup}; done, files read back.`)
else console.log('\nDry run: nothing changed. Add --apply (app closed) to do it.')
