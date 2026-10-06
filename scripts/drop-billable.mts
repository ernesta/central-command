/**
 * One-off: Work is billable work only. Puts the Work tasks that are not billable (no `billable` tag of their own or their parent's)
 * in the trash, then removes the `billable` tag from every task. Refuses if hours are linked to a task it would delete, or if a
 * subtask it would not delete sits under one it would.
 *
 *   npm run drop:billable              # dry run
 *   npm run drop:billable -- --apply   # app closed; backs up the hours and the database first, reads everything back
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { openDatabase } from '../src/main/db/connection'
import { parseYear } from '../src/shared/tracking/parse'
import { formatHours } from '../src/shared/tracking/format'
import { TasksStore } from '../src/modules/tasks/main/tasks-store'
import { writeTasksSnapshot } from '../src/modules/tasks/main/snapshot'

const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}
const apply = process.argv.includes('--apply')
const root = join(
  assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir()),
  'CentralCommand'
)
const workDir = join(root, 'time', 'work')
const databaseFile = join(root, 'data', 'central-command.sqlite')
if (!existsSync(databaseFile) || !existsSync(workDir)) fail(`No Work library under ${root}`)
const db = apply ? openDatabase(databaseFile) : new Database(databaseFile, { readonly: true })

interface Row {
  uid: string
  title: string
  parent_uid: string | null
  earlier_minutes: number
}
const live = db
  .prepare(
    "SELECT uid, title, parent_uid, earlier_minutes FROM tasks WHERE workspace = 'work' AND deleted_at IS NULL"
  )
  .all() as Row[]
const tagged = new Set(
  (
    db.prepare("SELECT task_uid FROM task_tags WHERE tag = 'billable'").all() as {
      task_uid: string
    }[]
  ).map((r) => r.task_uid)
)
const doomed = live.filter(
  (t) => !tagged.has(t.uid) && !(t.parent_uid !== null && tagged.has(t.parent_uid))
)
const doomedIds = new Set(doomed.map((t) => t.uid))
const problems: string[] = []

for (const t of live)
  if (t.parent_uid !== null && doomedIds.has(t.parent_uid) && !doomedIds.has(t.uid))
    problems.push(`A kept subtask sits under a task to delete: ${t.title}`)

const linked = new Set<string>()
for (const file of readdirSync(workDir).filter((f) => f.endsWith('.json'))) {
  const year = parseYear(JSON.parse(readFileSync(join(workDir, file), 'utf8')))
  if (!year) fail(`${file} is not a readable year file`)
  for (const x of [...year!.adjusts, ...year!.sessions])
    if (x.task) linked.add(x.task.replace('cc://task/', ''))
}
for (const t of doomed) if (linked.has(t.uid)) problems.push(`Hours are linked to ${t.title}`)

const minutes = doomed.reduce((n, t) => n + t.earlier_minutes, 0)
console.log(
  `${doomed.length} non-billable Work tasks to trash (${formatHours(minutes)} of ClickUp time); the billable tag is on ${tagged.size} tasks and comes off every one.`
)
for (const t of doomed) console.log(`  ${t.parent_uid ? '  ' : ''}${t.title}`)
if (problems.length > 0) {
  console.log('\nPROBLEMS, nothing changed:')
  for (const p of problems) console.log(`  ${p}`)
  process.exit(1)
}
if (!apply) {
  console.log('\nDry run: nothing changed. Add --apply (app closed) to do it.')
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = join(root, 'backups', `drop-billable-${stamp}`)
mkdirSync(backup, { recursive: true })
cpSync(workDir, join(backup, 'work'), { recursive: true })
db.prepare('VACUUM INTO ?').run(join(backup, 'central-command.sqlite'))
console.log(`\nBacked up to ${backup}`)

const store = new TasksStore(db)
for (const t of doomed.filter((x) => x.parent_uid === null)) store.delete(t.uid)
for (const t of doomed) if (t.parent_uid !== null && store.get(t.uid)) store.delete(t.uid)
db.prepare("DELETE FROM task_tags WHERE tag = 'billable'").run()

const left = (
  db.prepare("SELECT uid FROM tasks WHERE workspace = 'work' AND deleted_at IS NULL").all() as {
    uid: string
  }[]
).length
const tagsLeft = (
  db.prepare("SELECT COUNT(*) AS n FROM task_tags WHERE tag = 'billable'").get() as { n: number }
).n
const stillThere = doomed.filter((t) => store.get(t.uid)).length
const snapshot = writeTasksSnapshot(
  db,
  join(root, 'backups', 'tasks'),
  new Date(),
  'after-dropping-billable'
)
db.close()
const bad: string[] = []
if (left !== live.length - doomed.length)
  bad.push(`${left} Work tasks remain, expected ${live.length - doomed.length}`)
if (tagsLeft !== 0) bad.push(`${tagsLeft} billable tags remain`)
if (stillThere !== 0) bad.push(`${stillThere} tasks to delete are still there`)
if (bad.length > 0) {
  console.log(`\nPROBLEMS; restore from ${backup}:`)
  for (const b of bad) console.log(`  ${b}`)
  process.exit(1)
}
console.log(
  `\nRead back: ${doomed.length} tasks in the trash, ${left} Work tasks remain, no billable tag. A readable copy: ${snapshot}`
)
