/**
 * The worksheet for linking Work's hour entries to tasks, and its check. Nothing in the library is changed.
 *
 *   npm run link:worksheet -- --write <file.csv>    # one row per entry, pre-filled with the best matches (never overwrites)
 *   npm run link:worksheet -- --check <file.csv>    # reads your edited sheet and says what does not add up yet
 *
 * Edit the `task` column in a spreadsheet: a task's name (see `<file>-tasks.csv`), `NEW: Title [Sublist]` for a task to be
 * made, `-` for time that gets no task, or blank for undecided. To split an entry between tasks, copy its row, give each row its
 * share of the minutes and its own task. Billable is a task tagged `billable` (or a subtask of one) or any Luminos task outside
 * the Admin & Logistics sublist.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join, resolve } from 'path'
import Database from 'better-sqlite3'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { parseYear } from '../src/shared/tracking/parse'
import { reportedMinutes } from '../src/shared/tracking/rounding'
import { formatHours } from '../src/shared/tracking/format'
import { allocateByFlow } from '../src/main/tracking/import/work-task-flow'
import { planTaskLinks } from '../src/main/tracking/import/work-task-links'
import {
  buildRows,
  checkWorksheet,
  formatTaskList,
  formatWorksheet,
  parseWorksheet,
  ruleRows,
  taskNames,
  type SheetEntry,
  type SheetTask
} from '../src/main/tracking/import/work-links-sheet'

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}
const writeFile = arg('write')
const checkFile = arg('check')
if (!writeFile && !checkFile)
  fail('Usage: npm run link:worksheet -- --write <file.csv> | --check <file.csv>')

const root = join(
  assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir()),
  'CentralCommand'
)
const workDir = join(root, 'time', 'work')
const databaseFile = join(root, 'data', 'central-command.sqlite')
if (!existsSync(databaseFile) || !existsSync(workDir)) fail(`No Work library under ${root}`)

interface Row {
  uid: string
  title: string
  parent_uid: string | null
  list: string
  sublist: string
  earlier_minutes: number
  due: string | null
  created_at: string
  tags: string | null
}
const db = new Database(databaseFile, { readonly: true })
const rows = db
  .prepare(
    `SELECT t.uid, t.title, t.parent_uid, t.list, t.sublist, t.earlier_minutes, t.due, t.created_at,
            (SELECT group_concat(tag, '|') FROM task_tags g WHERE g.task_uid = t.uid) AS tags
       FROM tasks t WHERE t.workspace = 'work' AND t.deleted_at IS NULL`
  )
  .all() as Row[]
const byUid = new Map(rows.map((r) => [r.uid, r]))
const tagged = (r: Row): boolean => (r.tags ?? '').split('|').includes('billable')
const home = (r: Row): Row => (r.parent_uid ? (byUid.get(r.parent_uid) ?? r) : r)
const billable = (r: Row): boolean =>
  tagged(r) ||
  tagged(home(r)) ||
  (home(r).list === 'Luminos' && home(r).sublist !== 'Admin & Logistics')
const toTask = (r: Row): SheetTask => ({
  uid: r.uid,
  title: r.title,
  minutes: r.earlier_minutes,
  date: (r.due ?? r.created_at).slice(0, 10),
  billable: billable(r),
  list: home(r).list,
  sublist: home(r).sublist
})
const allTasks = rows.map(toTask)
const billableTasks = allTasks.filter((t) => t.billable)
const names = taskNames(allTasks)

const entries: SheetEntry[] = []
for (const file of readdirSync(workDir).filter((f) => f.endsWith('.json'))) {
  const year = parseYear(JSON.parse(readFileSync(join(workDir, file), 'utf8')))
  if (!year) fail(`${file} is not a readable year file`)
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
const total = (xs: { minutes: number }[]): number => xs.reduce((a, x) => a + x.minutes, 0)

if (writeFile) {
  const path = resolve(writeFile.replace(/^~(?=$|\/)/, homedir()))
  const tasksPath = path.replace(/\.csv$/i, '') + '-tasks.csv'
  if (existsSync(path) || existsSync(tasksPath))
    fail(`Not overwriting: ${path} or ${tasksPath} exists.`)
  const timed = billableTasks.filter((t) => t.minutes > 0)
  // Rules first: untracked 5 Oct work, activity logs and timers; the matching only sees what is left.
  const lastClickUpDay = rows.reduce(
    (d, r) => (r.created_at.slice(0, 10) > d ? r.created_at.slice(0, 10) : d),
    ''
  )
  const fixed = ruleRows(entries, billableTasks, names, lastClickUpDay)
  const ruled = new Set(fixed.map((f) => f.entry))
  const spent = new Map<string, number>()
  for (const f of fixed) if (f.uid) spent.set(f.uid, (spent.get(f.uid) ?? 0) + f.minutes)
  const free = entries.filter((e) => !ruled.has(e.key))
  const open = timed.filter((t) => (spent.get(t.uid) ?? 0) === 0)
  const exact = planTaskLinks(open, free).links
  const taken = new Set(exact.flatMap((l) => l.entries.map((e) => e.key)))
  const done = new Set(exact.map((l) => l.task.uid))
  const flow = allocateByFlow(
    open.filter((t) => !done.has(t.uid)),
    free.filter((e) => !taken.has(e.key))
  )
  const sheet = buildRows(entries, timed, exact, flow, names, fixed)
  writeFileSync(path, formatWorksheet(sheet))
  writeFileSync(tasksPath, formatTaskList(timed, names))
  const blank = sheet.filter((r) => r.task === '')
  console.log(`Wrote ${path} (${sheet.length} rows, ${formatHours(total(entries))} of entries)`)
  console.log(
    `Wrote ${tasksPath} (${timed.length} billable tasks with time, ${formatHours(total(timed))})`
  )
  console.log(
    `Pre-filled: ${fixed.length} rows by your rules (5 Oct, activity logs, timers), ${exact.length} tasks by exact sums, ${new Set(flow.map((a) => a.task.uid)).size} by best fit; ${blank.length} rows (${formatHours(total(blank))}) still blank.`
  )
}

if (checkFile) {
  const path = resolve(checkFile.replace(/^~(?=$|\/)/, homedir()))
  if (!existsSync(path)) fail(`Not found: ${path}`)
  const result = checkWorksheet(
    parseWorksheet(readFileSync(path, 'utf8')),
    entries,
    allTasks,
    names,
    new Set(billableTasks.map((t) => t.uid))
  )
  const line = (s: string): void => console.log(s)
  line(`Sheet: ${path}\n`)
  if (result.problems.length > 0) {
    line('PROBLEMS')
    for (const p of result.problems) line(`  ${p}`)
    line('')
  }
  const off = result.tasks.filter((t) => t.fit !== 'exact')
  line(
    `Billable tasks with ClickUp time: ${result.tasks.length}; exact ${result.tasks.length - off.length}, not exact ${off.length}`
  )
  for (const t of off)
    line(
      `  ${t.fit === 'short' ? 'SPLIT' : 'hours+'} ${formatHours(Math.abs(t.task.minutes - t.assigned)).padStart(6)}  ${t.name}   (ClickUp ${formatHours(t.task.minutes)}, sheet ${formatHours(t.assigned)})`
    )
  line(
    `\nEntries with no task yet: ${result.unassigned.length} rows, ${formatHours(total(result.unassigned))}`
  )
  line(
    `Entries marked "-" (no task): ${result.noTask.length} rows, ${formatHours(total(result.noTask))}`
  )
  if (result.newTasks.length > 0) {
    line(`\nTasks to be made (${result.newTasks.length}):`)
    for (const n of result.newTasks)
      line(
        `  ${formatHours(n.minutes).padStart(6)}  ${n.title}${n.sublist ? ` [${n.sublist}]` : ' [no sublist given]'}  (${n.entries.length} entries, due ${n.due})`
      )
  }
  if (result.dateChanges.length > 0) {
    line(`\nTask dates that would move to their last entry's day: ${result.dateChanges.length}`)
    for (const d of result.dateChanges) line(`  ${d.from} -> ${d.to}  ${d.name}`)
  }
  if (result.notBillable.length > 0) {
    line(`\nGiven to a task that is not billable: ${result.notBillable.length} rows`)
    for (const r of result.notBillable) line(`  ${formatHours(r.minutes)}  ${r.task}  (${r.id})`)
  }
  line(
    `\n${result.complete ? 'COMPLETE: every entry is accounted for and every billable task adds up.' : 'NOT COMPLETE yet.'}`
  )
}
