/**
 * The tasks the app makes for meetings and trainings, checked against the notes that name them (docs/MEETING_TASKS_PLAN.md,
 * docs/POLISH_ROUND_2_PLAN.md item 3). A training's tasks and hours are mapped by hand; here a task a Research training note names
 * only gets its marker (`own_kind`), so it is locked and linked to its note.
 * Dry run by default: the database is read through a throwaway copy, so nothing on disk is touched, and the report says, line by
 * line, what `--apply` would do.
 *
 *   npm run repair:session-tasks
 *   npm run repair:session-tasks -- --apply   # app closed; backs the database up first
 *
 * It reports each meeting's task (exists, is its own, has the title, series task and due date the note calls for, shared by two
 * meetings, marker missing) and the own-looking subtasks no meeting names (orphans, with the time tracked on them). `--apply` marks
 * the meeting tasks, renames, dates and re-parents them, marks the tasks the training notes name (training, self-study), brings the
 * series tasks in step with their subtasks (latest date, Done once all are), and puts the orphans with no time tracked in the Tasks trash (restorable);
 * it refuses to write unless a second look finds nothing left to repair.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { openDatabase } from '../src/main/db/connection'
import { runMigrations } from '../src/main/db/migrate'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { parseYear } from '../src/shared/tracking/parse'
import { todayIso } from '../src/shared/time'
import { tasksMigrationsFromDir } from '../src/modules/tasks/main/import/migration-files'
import {
  applyRepair,
  dateRegion,
  formatRepairReport,
  planRepair,
  readRepairInput
} from '../src/modules/tasks/main/session-repair'
import { trackedByTask } from '../src/modules/tasks/shared/tracked'
import { workClients } from '../src/modules/tasks/shared/work-lists'
import type { TrackingYear } from '../src/shared/tracking/types'

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
const migrations = tasksMigrationsFromDir(join(process.cwd(), 'src/modules/tasks/main/migrations'))

const years = (workspace: 'research' | 'work'): TrackingYear[] => {
  const dir = join(root, 'time', workspace)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      const year = parseYear(JSON.parse(readFileSync(join(dir, f), 'utf8')))
      return year ? [year] : []
    })
}
const clients = workClients(years('work').map((y) => y.plan))
const tracked = trackedByTask([...years('research'), ...years('work')])

/**
 * A throwaway copy of the database with the newest task migrations on it, so a library the app has not opened since still reads.
 * Made with VACUUM INTO (it needs no write to the library and leaves the WAL behind), in a folder removed afterwards.
 */
const scratch = mkdtempSync(join(tmpdir(), 'cc-repair-'))
const copyFile = join(scratch, 'copy.sqlite')
const reader = new Database(databaseFile, { readonly: true })
reader.prepare('VACUUM INTO ?').run(copyFile)
reader.close()
const copy = new Database(copyFile)
runMigrations(copy, migrations)
const report = planRepair(readRepairInput(copy), clients, tracked)
console.log(formatRepairReport(report, dateRegion()))
copy.close()
rmSync(scratch, { recursive: true, force: true })

if (!apply) {
  console.log('\nDry run: nothing changed. Add --apply (app closed) to do what is listed.')
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backups = join(root, 'backups', `session-tasks-${stamp}`)
mkdirSync(backups, { recursive: true })
cpSync(databaseFile, join(backups, 'central-command.sqlite'))

const db = openDatabase(databaseFile)
try {
  runMigrations(db, migrations)
  const done = applyRepair(db, clients, tracked)
  console.log(
    `\nMarked ${done.marked} task(s); renamed, dated or re-parented ${done.changed}; trashed ${done.trashed} leftover(s).`
  )
  console.log(`Backup: ${backups} (today is ${todayIso()})`)
} finally {
  db.close()
}
