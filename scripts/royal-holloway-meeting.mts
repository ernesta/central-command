/**
 * One-off (28 Oct 2026, the user's request): split the Royal Holloway kick-off task `uc8k3frf` ("Kick-off meeting and follow-up",
 * 75 min) in two. The 2 Oct note gets a meeting task of its own (series task "Royal Holloway meetings", subtask
 * "Royal Holloway meetings · 2 Oct 2026", `own_kind = meeting`), whose hours come from the note's times (45 min); the old task is
 * renamed "Kick-off meeting follow-up" and keeps the rest (75 − 45 = 30 min). The contract's total must not change; the script
 * says so, or refuses. Nothing is trashed.
 *
 *   npm run royal-holloway:meeting               # dry run: a throwaway copy of the database
 *   npm run royal-holloway:meeting -- --apply    # app closed; backs up the note, the database and the contract file first
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { openDatabase } from '../src/main/db/connection'
import { runMigrations } from '../src/main/db/migrate'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { tasksMigrationsFromDir } from '../src/modules/tasks/main/import/migration-files'
import { TasksStore } from '../src/modules/tasks/main/tasks-store'
import { applyChanges, splitNote } from '../src/modules/meetings/shared/front-matter'
import { meetingTaskTitle } from '../src/modules/meetings/shared/meeting-task'
import { durationMinutes } from '../src/modules/meetings/shared/time'

const apply = process.argv.includes('--apply')
const root = join(
  assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir()),
  'CentralCommand'
)
const databaseFile = join(root, 'data', 'central-command.sqlite')
const noteName = '2026-10-02 Royal Holloway.md'
const noteFile = join(root, 'notes', 'meetings', 'work', noteName)
const contractName = '2026-09-28.json'
const contractFile = join(root, 'time', 'work', contractName)

const OLD_TASK = 'uc8k3frf'
const OLD_TITLE = 'Kick-off meeting and follow-up'
const NEW_TITLE = 'Kick-off meeting follow-up'
const SERIES = { title: 'Royal Holloway meetings', list: 'Royal Holloway', sublist: '' }
const ADJUST = '602749b9'

const migrations = tasksMigrationsFromDir(join(process.cwd(), 'src/modules/tasks/main/migrations'))

interface Adjust {
  id: string
  date: string
  minutes: number
  task?: string
  [key: string]: unknown
}

async function main(): Promise<void> {
  if (!existsSync(databaseFile)) throw new Error(`No library under ${root}`)
  console.log(apply ? 'Mode: APPLY\n' : 'Mode: dry run (nothing in the library is written)\n')

  const note = await readNoteFile(noteFile)
  if (!note.exists) throw new Error(`Missing note ${noteName}`)
  const { head } = splitNote(note.content)
  const date = /^date:\s*['"]?(\d{4}-\d{2}-\d{2})/m.exec(head)?.[1]
  const start = /^start:\s*['"]?(\d{2}:\d{2})/m.exec(head)?.[1]
  const end = /^end:\s*['"]?(\d{2}:\d{2})/m.exec(head)?.[1]
  const task = /^task:\s*['"]?([^'"\s]+)/m.exec(head)?.[1]
  if (date !== '2026-10-02' || !start || !end) throw new Error('The note is not as expected')
  if (task !== OLD_TASK) throw new Error(`The note names ${task}, not ${OLD_TASK}: already done?`)
  const minutes = durationMinutes(start, end)
  if (minutes === null || minutes <= 0) throw new Error('Bad times in the note')

  // --- the contract file: the meeting's minutes leave the old task's adjust ------------------
  const contract = JSON.parse(readFileSync(contractFile, 'utf8')) as { adjusts: Adjust[] }
  const sum = (): number => contract.adjusts.reduce((n, a) => n + a.minutes, 0)
  const before = sum()
  const row = contract.adjusts.find((a) => a.id === ADJUST)
  if (!row || row.task !== `cc://task/${OLD_TASK}` || row.date !== date)
    throw new Error(`Adjust ${ADJUST} is not the kick-off task's on ${date}`)
  if (row.minutes < minutes)
    throw new Error(`The task holds ${row.minutes} min, the meeting is ${minutes}`)
  row.minutes -= minutes
  const after = sum() + minutes
  console.log(
    `${noteName}  ${start}–${end} (${minutes} min)\n` +
      `Contract hours: ${before} min before; ${after} min after (adjusts ${sum()} + meeting ${minutes}); ` +
      `"${NEW_TITLE}" keeps ${row.minutes} min.`
  )
  if (after !== before) throw new Error('The contract total would change; nothing written.')

  // --- the database, on a throwaway copy unless applying ------------------------------------
  const scratch = mkdtempSync(join(tmpdir(), 'cc-royal-holloway-'))
  const copyFile = join(scratch, 'copy.sqlite')
  let dbFile = databaseFile
  if (!apply) {
    const reader = new Database(databaseFile, { readonly: true })
    reader.prepare('VACUUM INTO ?').run(copyFile)
    reader.close()
    dbFile = copyFile
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backups = join(root, 'backups', `royal-holloway-meeting-${stamp}`)
  if (apply) {
    mkdirSync(join(backups, 'notes'), { recursive: true })
    cpSync(databaseFile, join(backups, 'central-command.sqlite'))
    cpSync(contractFile, join(backups, contractName))
  }
  const db = openDatabase(dbFile)
  let uid = ''
  try {
    runMigrations(db, migrations)
    const store = new TasksStore(db)
    db.transaction(() => {
      const old = store.get(OLD_TASK)
      if (!old || old.title !== OLD_TITLE) throw new Error(`${OLD_TASK} is not "${OLD_TITLE}"`)
      if (old.earlierMinutes < minutes)
        throw new Error(`${OLD_TASK} holds ${old.earlierMinutes} min earlier, less than ${minutes}`)
      const series = store.create({
        workspace: 'work',
        title: SERIES.title,
        list: SERIES.list,
        sublist: SERIES.sublist
      })
      uid = store.create({
        workspace: 'work',
        title: meetingTaskTitle(SERIES.title, date),
        parentUid: series.uid,
        due: date,
        status: 'done',
        ownKind: 'meeting'
      }).uid
      store.update(OLD_TASK, { title: NEW_TITLE })
      db.prepare('UPDATE tasks SET earlier_minutes = earlier_minutes - ? WHERE uid = ?').run(
        minutes,
        OLD_TASK
      )
      store.settleSeries(series.uid)
    })()
    const t = db
      .prepare('SELECT title, earlier_minutes FROM tasks WHERE uid = ?')
      .get(OLD_TASK) as {
      title: string
      earlier_minutes: number
    }
    console.log(
      `Old task ${OLD_TASK}: "${t.title}", earlier_minutes ${t.earlier_minutes}.\n` +
        `New: series "${SERIES.title}" (${SERIES.list}), meeting task ${uid} "${meetingTaskTitle(SERIES.title, date)}".`
    )
  } finally {
    db.close()
  }

  // --- the note -----------------------------------------------------------------------------
  const text = applyChanges(note.content, { meta: { task: uid } })
  if (apply) {
    writeFileSync(join(backups, 'notes', noteName), note.content)
    const { result } = await writeNoteFileGuarded(noteFile, text, note.hash)
    if (result.status === 'conflict') throw new Error(`${noteName} changed while this ran`)
    writeFileSync(contractFile, JSON.stringify(contract, null, 2) + '\n')
    console.log(`\nDone. Backups: ${backups}`)
  } else {
    console.log('\nDry run: nothing changed.')
  }
  rmSync(scratch, { recursive: true, force: true })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
