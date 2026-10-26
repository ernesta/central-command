/**
 * Self-study tasks for the Life trainings that were made before the sweep covered Life (26 Oct 2026): each Life entry with a title and a
 * date but no `selfstudy:` gets its task, as the sweep makes it (the series task, the entry's subtask due a week after it, linked into the
 * note). The sweep's "made in the app" rule is lifted for these entries, at the user's word that they were.
 * Dry run by default: a throwaway copy of the database and of the Life notes, nothing in the library is touched.
 *
 *   npm run backfill:life-self-study
 *   npm run backfill:life-self-study -- --apply   # app closed; backs the database and the notes up first
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { join } from 'path'
import type { Database as Db } from 'better-sqlite3'
import { openDatabase } from '../src/main/db/connection'
import { runMigrations } from '../src/main/db/migrate'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { tasksMigrationsFromDir } from '../src/modules/tasks/main/import/migration-files'
import { listTasks } from '../src/modules/tasks/main/repository'
import { TasksStore } from '../src/modules/tasks/main/tasks-store'
import { localMoment } from '../src/modules/tasks/main/session-sweep'
import { settleSelfStudyTasks } from '../src/modules/training/main/self-study-sweep'
import { TrainingStore } from '../src/modules/training/main/training-store'

const apply = process.argv.includes('--apply')
const root = join(
  assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir()),
  'CentralCommand'
)
const databaseFile = join(root, 'data', 'central-command.sqlite')
const lifeNotes = join(root, 'notes', 'training', 'life')
if (!existsSync(databaseFile) || !existsSync(lifeNotes)) {
  console.error(`No library under ${root}`)
  process.exit(1)
}
const migrations = tasksMigrationsFromDir(join(process.cwd(), 'src/modules/tasks/main/migrations'))

async function run(db: Db, notesRoot: string): Promise<void> {
  runMigrations(db, migrations)
  const before = new Set(listTasks(db, 'life').map((t) => t.uid))
  const training = new TrainingStore({
    db,
    dirFor: (w) => (w === 'life' ? notesRoot : join(root, 'notes', 'training', w)),
    trash: async () => undefined
  })
  await training.reindexAll('life')
  const changed = await settleSelfStudyTasks({
    db,
    tasks: new TasksStore(db),
    training,
    now: localMoment(),
    nowMs: Date.now(),
    quietMs: 0, // the app is closed, and the dry run's copies are new files
    adopt: (ref) => ref.workspace === 'life'
  })
  if (!changed.includes('life'))
    console.log('Nothing to make: every Life training already has its task.')
  for (const t of listTasks(db, 'life').filter((t) => !before.has(t.uid))) {
    console.log(`+ ${t.title}  (${t.ownKind ?? 'series task'}, due ${t.due ?? 'no date'})`)
  }
}

if (!apply) {
  const scratch = mkdtempSync(join(tmpdir(), 'cc-life-selfstudy-'))
  try {
    const reader = openDatabase(databaseFile)
    reader.prepare('VACUUM INTO ?').run(join(scratch, 'copy.sqlite'))
    reader.close()
    cpSync(lifeNotes, join(scratch, 'life'), { recursive: true })
    const copy = openDatabase(join(scratch, 'copy.sqlite'))
    await run(copy, join(scratch, 'life'))
    copy.close()
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
  console.log('\nDry run: nothing changed. Add --apply (app closed) to do what is listed.')
} else {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backups = join(root, 'backups', `life-self-study-${stamp}`)
  mkdirSync(backups, { recursive: true })
  cpSync(databaseFile, join(backups, 'central-command.sqlite'))
  cpSync(lifeNotes, join(backups, 'life'), { recursive: true })
  const db = openDatabase(databaseFile)
  try {
    await run(db, lifeNotes)
    console.log(`\nBackup: ${backups}`)
  } finally {
    db.close()
  }
}
