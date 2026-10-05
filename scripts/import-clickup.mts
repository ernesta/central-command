/**
 * One-off importer: bring your ClickUp export (one CSV) into Tasks.
 *
 *   npm run import:clickup -- --file <export.csv>            # dry run: the report, nothing written
 *   npm run import:clickup -- --file <export.csv> --apply    # writes the tasks (app closed)
 *
 * The export lists most tasks twice, so rows are de-duplicated by Task ID first; two rows with one id that differ stop the
 * import. The CSV is only read. The tasks go into `~/CentralCommand/data/central-command.sqlite` (or under
 * CENTRAL_COMMAND_HOME). Never adds to a store that already holds tasks. The report shows every count the plan promised
 * (rows before and after, status, top-level and subtasks, time), what moved (subtask dates, sub-subtasks), and each
 * series that looks recurring with a proposed rule (nothing is set until you confirm it in the app). `--apply` refuses
 * when any check fails.
 */
import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join, resolve } from 'path'
import Database from 'better-sqlite3'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { openDatabase } from '../src/main/db/connection'
import { runMigrations } from '../src/main/db/migrate'
import { parseCsv } from '../src/modules/tasks/main/import/csv'
import { applyClickupPlan } from '../src/modules/tasks/main/import/clickup-apply'
import {
  checkPlan,
  planImport,
  readClickup,
  sourceTotals
} from '../src/modules/tasks/main/import/clickup-import'
import { tasksMigrationsFromDir } from '../src/modules/tasks/main/import/migration-files'
import { countAllTasks } from '../src/modules/tasks/main/repository'
import { writeTasksSnapshot } from '../src/modules/tasks/main/snapshot'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const expand = (p: string): string => resolve(p.replace(/^~(?=$|\/)/, homedir()))
const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}

const fileArg = arg('file')
if (!fileArg) fail('Usage: npm run import:clickup -- --file <ClickUp export .csv> [--apply]')
const file = expand(fileArg as string)
if (!existsSync(file)) fail(`File not found: ${file}`)
const apply = process.argv.includes('--apply')
const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const root = join(home, 'CentralCommand')
const databaseFile = join(root, 'data', 'central-command.sqlite')

const nf = (n: number): string => n.toLocaleString('en-GB')
const hours = (minutes: number): string => `${nf(Math.round(minutes / 6) / 10)} h`

let data
try {
  data = readClickup(parseCsv(readFileSync(file, 'utf8')))
} catch (error) {
  fail(`Not importing: ${(error as Error).message}`)
}
const plan = planImport(data as ReturnType<typeof readClickup>)
const r = plan.report
const source = sourceTotals((data as ReturnType<typeof readClickup>).rows)
const problems = checkPlan(plan, source)

console.log(`ClickUp export: ${file}`)
console.log(
  `\nRows: ${nf(r.rowsBefore)} -> ${nf(r.rowsAfter)} after de-duplicating by Task ID (${nf(r.repeatedIds)} ids listed twice, the rows identical)`
)
console.log(
  `Tasks to import: ${nf(r.planned)}  (Research ${nf(r.byWorkspace.research)}, Work ${nf(r.byWorkspace.work)})`
)
console.log(
  `Status: ${nf(r.byStatus.done)} complete, ${nf(r.byStatus.todo)} to do, ${nf(r.byStatus.doing)} in progress`
)
console.log(`Top-level ${nf(r.topLevel)}, subtasks ${nf(r.subtasks)}`)
console.log(
  `Priority (top-level): High ${r.byPriority.high}, Normal ${r.byPriority.normal}, Low ${r.byPriority.low}`
)
console.log(
  `Time: ${hours(r.totalMinutes)} across ${nf(r.tasksWithTime)} tasks (${nf(r.totalMinutes)} min; the file: ${nf(source.totalMinutes)} min)`
)
console.log(
  `\nSubtask dates: ${nf(r.subtaskDatesDropped)} dropped (they repeated the parent's), ${nf(r.subtaskDatesKept)} kept`
)
console.log(`Parents with no date that took a subtask's earliest: ${r.parentsTookDate.length}`)
for (const p of r.parentsTookDate) console.log(`  ${p.due}  ${p.title}`)
console.log(`\nSub-subtasks moved up to the top-level task: ${r.flattened.length}`)
for (const f of r.flattened) console.log(`  "${f.newTitle}"  (under "${f.underTitle}")`)
console.log(`\nAttachments (kept as links at the end of the description): ${r.attachments.length}`)
for (const a of r.attachments) console.log(`  ${a.task}: ${a.title}`)
if (r.unimported.length > 0) {
  console.log(`\nNOT imported:`)
  for (const u of r.unimported) console.log(`  ${u}`)
}
if (r.subtaskIdMismatches.length > 0) {
  console.log(
    `\nSubtasks IDs that disagree with the tasks naming a parent (the export leaves that column empty for most parents; only parents that list some are checked): ${r.subtaskIdMismatches.length}`
  )
  for (const m of r.subtaskIdMismatches) console.log(`  ${m}`)
}
console.log(
  `\nSeries that look recurring, with exactly one open instance: ${r.series.length} (nothing is set; confirm each in the app)`
)
for (const s of r.series) {
  console.log(
    `  ${s.rule.padEnd(14)} ${String(s.instances).padStart(3)}x  next due ${s.openDue ?? 'no date'}  [${s.list}]  ${s.title}` +
      (s.medianGapDays !== null ? `  (median gap ${s.medianGapDays} days)` : '')
  )
}
if (r.otherRepeats.length > 0) {
  console.log(
    `\nOther titles that repeat four or more times (none or several open; not proposed): ${r.otherRepeats.length}`
  )
  for (const o of r.otherRepeats)
    console.log(`  ${String(o.instances).padStart(3)}x  ${o.open} open  [${o.list}]  ${o.title}`)
}
if (r.leftOut.length > 0) {
  console.log(`\nLEFT OUT (failed a check):`)
  for (const l of r.leftOut) console.log(`  ${l.sourceId}  ${l.title}: ${l.reason}`)
}
console.log(
  problems.length === 0
    ? '\nChecks: all passed.'
    : `\nATTENTION:\n${problems.map((p) => `  ${p}`).join('\n')}`
)

function existingTasks(): number {
  if (!existsSync(databaseFile)) return 0
  const db = new Database(databaseFile, { readonly: true })
  try {
    return (db.prepare('SELECT COUNT(*) AS n FROM tasks').get() as { n: number }).n
  } catch {
    return 0 // no tasks table yet
  } finally {
    db.close()
  }
}
const held = existingTasks()
if (held > 0) {
  console.log(
    `\nTasks already holds ${nf(held)} task(s): --apply would refuse, the import never adds to them.`
  )
}

if (!apply) {
  console.log(
    '\nDry run: nothing was written. Add --apply to write the tasks (with the app closed).'
  )
  process.exit(problems.length === 0 ? 0 : 1)
}
if (problems.length > 0) fail('\nNot applying: a check failed (see ATTENTION above).')

const db = openDatabase(databaseFile)
try {
  runMigrations(
    db,
    tasksMigrationsFromDir(join(process.cwd(), 'src/modules/tasks/main/migrations'))
  )
  if (countAllTasks(db) > 0)
    fail('\nNot applying: Tasks already holds tasks, and the import never adds to them.')
  const { created } = applyClickupPlan(db, plan)
  const snapshot = writeTasksSnapshot(
    db,
    join(root, 'backups', 'tasks'),
    new Date(),
    'after-import'
  )
  console.log(
    `\nApplied: ${nf(created)} tasks written to ${databaseFile}, read back and matched the plan.`
  )
  console.log(`A readable copy: ${snapshot}`)
} finally {
  db.close()
}
