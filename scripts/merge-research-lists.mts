/**
 * One-off (9 Oct 2026): Research's "Coursework & Training" and "Training" become one list, "Training", and "Supervisor Meetings" and
 * "Meetings" become one list, "Meetings". Sublists stay.
 *
 *   npm run merge:research-lists              # dry run
 *   npm run merge:research-lists -- --apply   # app closed; backs up the database first, reads everything back
 */
import { existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { openDatabase } from '../src/main/db/connection'
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
const databaseFile = join(root, 'data', 'central-command.sqlite')
if (!existsSync(databaseFile)) fail(`No library under ${root}`)
const db = apply ? openDatabase(databaseFile) : new Database(databaseFile, { readonly: true })

const MERGES: Record<string, string> = {
  'Coursework & Training': 'Training',
  'Supervisor Meetings': 'Meetings'
}
interface Row {
  uid: string
  title: string
  list: string
  sublist: string
}
const find = (): Row[] =>
  db
    .prepare(
      `SELECT uid, title, list, sublist FROM tasks
       WHERE workspace = 'research' AND deleted_at IS NULL AND list IN (${Object.keys(MERGES)
         .map(() => '?')
         .join(',')})`
    )
    .all(...Object.keys(MERGES)) as Row[]

const moves = find()
for (const from of Object.keys(MERGES)) {
  const n = moves.filter((m) => m.list === from).length
  console.log(`${from} -> ${MERGES[from]}: ${n} tasks`)
}
const target = db
  .prepare(
    "SELECT list, COUNT(*) AS n FROM tasks WHERE workspace = 'research' AND deleted_at IS NULL AND list IN ('Training', 'Meetings') GROUP BY list"
  )
  .all() as { list: string; n: number }[]
for (const t of target) console.log(`${t.list} already holds ${t.n} tasks`)
if (!apply) {
  console.log('\nDry run: nothing changed. Add --apply (app closed) to do it.')
  process.exit(0)
}
if (moves.length === 0) fail('Nothing to merge.')

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = join(root, 'backups', `merge-research-lists-${stamp}`)
mkdirSync(backup, { recursive: true })
db.prepare('VACUUM INTO ?').run(join(backup, 'central-command.sqlite'))
console.log(`\nBacked up to ${backup}`)

const store = new TasksStore(db)
for (const m of moves) store.update(m.uid, { list: MERGES[m.list], sublist: m.sublist })

const bad: string[] = []
if (find().length > 0) bad.push('tasks remain in an old list')
const total = (
  db
    .prepare("SELECT COUNT(*) AS n FROM tasks WHERE workspace = 'research' AND deleted_at IS NULL")
    .get() as { n: number }
).n
const snapshot = writeTasksSnapshot(
  db,
  join(root, 'backups', 'tasks'),
  new Date(),
  'after-merge-research-lists'
)
db.close()
if (bad.length > 0) {
  console.log(`\nPROBLEMS; restore from ${backup}:`)
  for (const b of bad) console.log(`  ${b}`)
  process.exit(1)
}
console.log(`\nRead back: all as planned (${total} Research tasks). A readable copy: ${snapshot}`)
