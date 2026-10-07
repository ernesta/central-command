/**
 * One-off: links every Work meeting note to the task that already holds its hours, and the two 0-minute Liberia timer sessions of
 * 5 Oct to their task. Creates nothing and changes no hours (docs/DECISIONS.md, "Linking Work's meetings").
 *
 *   npm run link:work-meetings              # dry run
 *   npm run link:work-meetings -- --apply   # app closed; backs up the notes and time/work first, reads the files back
 */
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { linkWorkMeetings } from '../src/modules/meetings/main/import/work-meeting-links'

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
const db = new Database(databaseFile, { readonly: true })
const row = db.prepare(
  "SELECT title, list FROM tasks WHERE uid = ? AND workspace = 'work' AND deleted_at IS NULL"
)
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const report = linkWorkMeetings(root, apply, stamp, (uid) => {
  const t = row.get(uid) as { title: string; list: string } | undefined
  return t ?? null
})
for (const line of report.lines) console.log(line)
if (!report.ok) {
  console.log('\nPROBLEMS: nothing was written.')
  process.exit(1)
}
if (report.backup)
  console.log(`\nBacked up to ${report.backup}; changed ${report.changed} files, read back.`)
else if (!apply)
  console.log(`\nDry run: ${report.changed} files would change. Add --apply (app closed) to do it.`)
else console.log('\nNothing to change.')
