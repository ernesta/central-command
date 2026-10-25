/**
 * One-off (25 Oct 2026): connects the SENSS Experimental Methods task and its subtasks to the series' four training notes, names them
 * after the notes, adds the self-study tasks and moves the part of a session over 3 hours to its self-study
 * (see src/modules/training/main/import/senss-experimental-link.ts).
 *
 *   npm run link:senss-experimental              # dry run
 *   npm run link:senss-experimental -- --apply   # app closed; backs up the database, the training notes and Research's hours first
 */
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { openDatabase } from '../src/main/db/connection'
import { linkSenss } from '../src/modules/training/main/import/senss-experimental-link'

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
const report = linkSenss(root, db, apply, stamp)
db.close()
for (const line of report.lines) console.log(line)
if (!report.ok) {
  console.log('\nPROBLEMS: nothing was written.')
  process.exit(1)
}
if (report.backup) console.log(`\nBacked up to ${report.backup}; done, files read back.`)
else console.log('\nDry run: nothing changed. Add --apply (app closed) to do it.')
