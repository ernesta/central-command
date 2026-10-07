/**
 * Finish linking Work's hours to tasks, from the worksheet and its ClickUp changes (see `npm run link:worksheet`).
 *
 *   npm run link:work-apply                     # dry run: prints every task rename, date, ClickUp time and entry link; writes nothing
 *   npm run link:work-apply -- --apply          # does it (the app must be closed)
 *
 * What it writes: splits, merges (the merged task goes to the trash), moves of ClickUp time, new tasks, every linked task renamed
 * to its entry's name and dated on its last typed entry, and on every hours entry its task and (when ClickUp's
 * time already holds it) `earlier`. Hours never change. Before writing it copies `time/work/` and the database to
 * `~/CentralCommand/backups/work-final-<time>/`; it writes the tasks in one transaction, the hours through the Hours store, then
 * reads everything back and checks the totals; a failed read-back says what to restore.
 */
import { execSync } from 'child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join, resolve } from 'path'
import { assertAbsoluteHome } from '../src/main/home-dir'
import Database from 'better-sqlite3'
import { openDatabase } from '../src/main/db/connection'
import { TrackingStore } from '../src/main/tracking/store'
import { nowMoment } from '../src/shared/time'
import { parseYear } from '../src/shared/tracking/parse'
import { reportedMinutes } from '../src/shared/tracking/rounding'
import { formatHours } from '../src/shared/tracking/format'
import { yearMinutes } from '../src/shared/tracking/totals'
import { planFinal, type ApplyTask } from '../src/main/tracking/import/work-links-apply'
import {
  applyChanges,
  parseChanges,
  parseWorksheet,
  taskNames,
  type SheetEntry
} from '../src/main/tracking/import/work-links-sheet'
import { TasksStore } from '../src/modules/tasks/main/tasks-store'
import { markDeleted } from '../src/modules/tasks/main/repository'
import { writeTasksSnapshot } from '../src/modules/tasks/main/snapshot'
import { taskKey } from '../src/modules/tasks/shared/tracked'

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
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
const sheetPath = resolve(
  (arg('sheet') ?? join(root, 'imports', 'work-links', 'worksheet.csv')).replace(
    /^~(?=$|\/)/,
    homedir()
  )
)
const changesPath = sheetPath.replace(/\.csv$/i, '') + '-changes.csv'
if (!existsSync(databaseFile) || !existsSync(workDir) || !existsSync(sheetPath))
  fail(`Missing: the database, the Work hours or ${sheetPath}`)

const h = formatHours
const db = apply ? openDatabase(databaseFile) : new Database(databaseFile, { readonly: true })
interface Row {
  uid: string
  title: string
  parent_uid: string | null
  status: string
  list: string
  sublist: string
  earlier_minutes: number
  due: string | null
  created_at: string
}
const load = (): Row[] =>
  db
    .prepare(
      `SELECT t.uid, t.title, t.parent_uid, t.status, t.list, t.sublist, t.earlier_minutes, t.due, t.created_at
         FROM tasks t WHERE t.workspace = 'work' AND t.deleted_at IS NULL`
    )
    .all() as Row[]
const rows = load()
const byUid = new Map(rows.map((r) => [r.uid, r]))
const homeOf = (r: Row): Row => (r.parent_uid ? (byUid.get(r.parent_uid) ?? r) : r)
const tasks: ApplyTask[] = rows.map((r) => ({
  uid: r.uid,
  title: r.title,
  minutes: r.earlier_minutes,
  date: (r.due ?? r.created_at).slice(0, 10),
  list: homeOf(r).list,
  sublist: homeOf(r).sublist,
  status: r.status,
  parentUid: r.parent_uid
}))
const names = taskNames(tasks)

let alreadyLinked = 0
const entries: SheetEntry[] = []
const years = readdirSync(workDir)
  .filter((f) => f.endsWith('.json'))
  .sort()
const hoursBefore = new Map<string, number>()
for (const file of years) {
  const year = parseYear(JSON.parse(readFileSync(join(workDir, file), 'utf8')))
  if (!year) fail(`${file} is not a readable year file`)
  hoursBefore.set(year!.start, yearMinutes(year!, undefined, nowMoment()))
  alreadyLinked +=
    year!.adjusts.filter((a) => a.task).length + year!.sessions.filter((x) => x.task).length
  for (const a of year!.adjusts)
    if (a.minutes > 0)
      entries.push({
        key: `${year!.start}/${a.id}`,
        date: a.date,
        label: a.label,
        minutes: a.minutes,
        client: a.client ?? '',
        kind: 'typed'
      })
  for (const s of year!.sessions) {
    const minutes = s.end === null ? 0 : reportedMinutes(s)
    if (minutes > 0)
      entries.push({
        key: `${year!.start}/${s.id}`,
        date: s.date,
        label: s.label,
        minutes,
        client: s.client ?? '',
        kind: 'timer'
      })
  }
}

if (alreadyLinked > 0)
  fail(
    `${alreadyLinked} hours entries already have a task: this was applied before (a second run would make the new tasks again).`
  )
const parsed = parseWorksheet(readFileSync(sheetPath, 'utf8'))
const changes = existsSync(changesPath)
  ? parseChanges(readFileSync(changesPath, 'utf8'))
  : { changes: [], problems: [] }
const plan = planFinal({ tasks, names, entries, rows: parsed.rows, changes: changes.changes })
const problems = [...parsed.problems, ...changes.problems, ...plan.problems]

const sum = (xs: number[]): number => xs.reduce((a, x) => a + x, 0)
const before = sum(rows.map((r) => r.earlier_minutes))
const after =
  sum(plan.tasks.map((t) => t.earlier)) +
  sum(
    rows
      .filter((r) => !plan.tasks.some((t) => t.target === r.uid) && !plan.retire.includes(r.uid))
      .map((r) => r.earlier_minutes)
  )
const changedTasks = applyChanges(tasks, names, changes.changes)
const afterAll = sum(changedTasks.tasks.map((t) => t.minutes))

console.log(`Library : ${root}`)
console.log(`Mode    : ${apply ? 'APPLY' : 'dry run (nothing is written)'}`)
console.log(
  `Sheet   : ${sheetPath} (${parsed.rows.length} rows), changes: ${changes.changes.length}\n`
)
console.log(
  `Entries ${entries.length} (${h(sum(entries.map((e) => e.minutes)))}); tasks that get hours ${plan.tasks.length} (${plan.tasks.filter((t) => !t.existing).length} new), ${plan.retire.length} merged away`
)
console.log(
  `ClickUp time in Work tasks: ${h(before)} before, ${h(afterAll)} after the splits, merges and moves (must be equal)`
)
void after
if (problems.length > 0) {
  console.log('\nPROBLEMS (nothing applied):')
  for (const p of problems) console.log(`  ${p}`)
  process.exit(1)
}
console.log(`\n=== Tasks: old name -> new name, date, ClickUp time, hours`)
for (const t of [...plan.tasks].sort((a, b) => a.due.localeCompare(b.due)))
  console.log(
    `${t.existing ? '    ' : 'NEW '}${t.due}  ClickUp ${h(t.earlier).padStart(6)}  hours ${h(t.hours).padStart(6)}  ${t.oldTitle === t.title ? t.title : `${t.oldTitle}  ->  ${t.title}`}`
  )
if (plan.retire.length > 0) {
  console.log(`\n=== Merged away (to the trash)`)
  for (const uid of plan.retire) console.log(`  ${byUid.get(uid)?.title}`)
}
const earlierN = plan.links.filter((l) => l.earlier).length
console.log(
  `\nEntries linked: ${plan.links.length} (${earlierN} already in ClickUp's time, ${plan.links.length - earlierN} hours only)`
)
if (!apply) process.exit(0)

// ---------------------------------------------------------------- apply
try {
  const running = execSync('pgrep -fl "Central Command|central-command" || true', {
    encoding: 'utf8'
  })
    .split('\n')
    .filter((l) => l && !/link-work-apply|pgrep/.test(l))
  if (running.length > 0 && !process.env.CENTRAL_COMMAND_HOME)
    fail(`Close the app first:\n${running.join('\n')}`)
} catch {
  // pgrep not available: carry on
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = join(root, 'backups', `work-final-${stamp}`)
mkdirSync(backup, { recursive: true })
cpSync(workDir, join(backup, 'work'), { recursive: true })
db.prepare('VACUUM INTO ?').run(join(backup, 'central-command.sqlite'))
console.log(`\nBacked up the Work hours and the database to ${backup}`)

const store = new TasksStore(db)
const uidOf = new Map<string, string>()
const now = new Date().toISOString()
db.transaction(() => {
  const merged = new Map(changedTasks.tasks.map((t) => [t.uid, t]))
  // New tasks first (splits keep their source's list; the rest go to Luminos with their sublist).
  for (const t of plan.tasks.filter((x) => !x.existing)) {
    const made = store.create({
      workspace: 'work',
      title: t.title,
      list: t.list,
      sublist: t.sublist,
      status: 'done',
      due: t.due,
      earlierMinutes: t.earlier
    })
    uidOf.set(t.target, made.uid)
  }
  const setTask = db.prepare(
    'UPDATE tasks SET title = ?, due = ?, earlier_minutes = ?, updated_at = ? WHERE uid = ?'
  )
  for (const t of plan.tasks.filter((x) => x.existing)) {
    setTask.run(t.title, t.due, t.earlier, now, t.target)
    uidOf.set(t.target, t.target)
  }
  // Tasks that only changed ClickUp time (the source of a split or a move that holds no hours of its own).
  for (const m of merged.values()) {
    const row = byUid.get(m.uid)
    if (row && !plan.tasks.some((t) => t.target === m.uid) && row.earlier_minutes !== m.minutes)
      setTask.run(row.title, row.due, m.minutes, now, m.uid)
  }
  markDeleted(db, plan.retire, now)
})()

const tracking = new TrackingStore(join(root, 'time'), { starts: () => [], now: () => nowMoment() })
const byYear = new Map<string, { id: string; task: string; earlier: boolean }[]>()
for (const l of plan.links) {
  const [start, id] = l.key.split('/')
  byYear.set(start, [
    ...(byYear.get(start) ?? []),
    { id, task: taskKey(uidOf.get(l.target) as string), earlier: l.earlier }
  ])
}
for (const [start, links] of byYear) {
  const result = tracking.linkAll('work', start, links)
  if (!result.ok)
    fail(`Could not link the hours of ${start}: ${result.reason}. Restore from ${backup}`)
  console.log(`Linked ${links.length} entries in ${start}.`)
}

// ---------------------------------------------------------------- read back
const bad: string[] = []
const dbAfter = load()
const live = new Map(dbAfter.map((r) => [r.uid, r]))
const closing = tracking
for (const file of years) {
  const year = parseYear(JSON.parse(readFileSync(join(workDir, file), 'utf8')))
  if (!year) {
    bad.push(`${file} unreadable`)
    continue
  }
  if (yearMinutes(year, undefined, nowMoment()) !== hoursBefore.get(year.start))
    bad.push(`${file}: total hours changed`)
  void closing
}
const hoursOf = new Map<string, { all: number; earlier: number }>()
let linked = 0
for (const file of years) {
  const year = parseYear(JSON.parse(readFileSync(join(workDir, file), 'utf8')))!
  for (const x of [
    ...year.adjusts.map((a) => ({ task: a.task, minutes: a.minutes, earlier: a.earlier === true })),
    ...year.sessions
      .filter((s) => s.end !== null)
      .map((s) => ({ task: s.task, minutes: reportedMinutes(s), earlier: false }))
  ]) {
    if (x.minutes <= 0) continue
    if (!x.task) {
      bad.push('an entry has no task')
      continue
    }
    linked++
    const uid = x.task.replace('cc://task/', '')
    const cur = hoursOf.get(uid) ?? { all: 0, earlier: 0 }
    cur.all += x.minutes
    if (x.earlier) cur.earlier += x.minutes
    hoursOf.set(uid, cur)
  }
}
if (linked !== entries.length) bad.push(`${linked} entries linked, ${entries.length} expected`)
for (const [uid, v] of hoursOf) {
  const row = live.get(uid)
  if (!row) bad.push(`task ${uid} is missing or in the trash`)
  else if (v.earlier > 0 && v.earlier !== row.earlier_minutes)
    bad.push(`${row.title}: ClickUp ${h(row.earlier_minutes)} but earlier hours ${h(v.earlier)}`)
  else if (v.earlier === 0 && row.earlier_minutes !== 0)
    bad.push(`${row.title}: has ClickUp time ${h(row.earlier_minutes)} and no earlier hours`)
}
const totalAfter = sum(dbAfter.map((r) => r.earlier_minutes))
if (totalAfter !== afterAll)
  bad.push(`ClickUp time ${h(totalAfter)} after, expected ${h(afterAll)}`)
const snapshot = writeTasksSnapshot(
  db,
  join(root, 'backups', 'tasks'),
  new Date(),
  'after-linking-hours'
)
db.close()
if (bad.length > 0) {
  console.log(`\n${bad.length} PROBLEMS in the read-back; restore from ${backup}:`)
  for (const b of bad) console.log(`  ${b}`)
  process.exit(1)
}
console.log(
  `\nRead back: ${linked} entries linked, every task's ClickUp time equals its earlier hours, ClickUp total ${h(totalAfter)} unchanged, hours totals unchanged.`
)
console.log(`A readable copy of the tasks: ${snapshot}`)
