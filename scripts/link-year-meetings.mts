/**
 * One-off (12 Oct 2026): gives every Research meeting of the year that has no task its own subtask, and takes a meeting already
 * inside a day's imported total out of that total (docs/DECISIONS.md, "Meetings get their tasks by themselves").
 *
 *   npm run link:year-meetings              # dry run
 *   npm run link:year-meetings -- --apply   # app closed; backs up the database, the meeting notes and Research's hours first
 */
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { todayIso } from '../src/shared/time'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { openDatabase } from '../src/main/db/connection'
import { linkYearMeetings } from '../src/modules/meetings/main/import/year-meeting-links'

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
const report = linkYearMeetings(root, db, apply, todayIso(), stamp)
db.close()
for (const line of report.lines) console.log(line)
if (!report.ok) {
  console.log('\nPROBLEMS: nothing was written.')
  process.exit(1)
}
if (report.backup) console.log(`\nBacked up to ${report.backup}; done, files read back.`)
else console.log('\nDry run: nothing changed. Add --apply (app closed) to do it.')
