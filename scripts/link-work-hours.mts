/**
 * One-off: link Work's imported hour entries to the tasks they were worked on, by the numbers (a task's ClickUp time must
 * equal the entries' minutes exactly).
 *
 *   npm run link:work-hours                        # dry run: every link, every task left alone, nothing written
 *   npm run link:work-hours -- --apply             # writes the high and medium links (app closed)
 *   npm run link:work-hours -- --apply --include-low   # also the low-confidence ones
 *
 * A linked entry keeps its date, label, client and minutes; it gains the task and `earlier` (ClickUp's time already holds
 * it, so Tasks does not add it again). Applying copies the Work year files to `~/CentralCommand/backups/` first, writes through
 * the Hours store, reads every file back and checks that each linked task's entries still add up to its ClickUp time and that
 * no year's total changed. Entries already linked are left out, so a second run only adds.
 *
 * Reads the Work year files in `~/CentralCommand/time/work/` and the tasks in the database (opened read only). Set
 * CENTRAL_COMMAND_HOME to read a scratch library instead.
 */
import { cpSync, existsSync, readdirSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { TrackingStore } from '../src/main/tracking/store'
import { yearMinutes } from '../src/shared/tracking/totals'
import { nowMoment } from '../src/shared/time'
import { parseYear } from '../src/shared/tracking/parse'
import { formatHours } from '../src/shared/tracking/format'
import {
  planTaskLinks,
  type LinkEntry,
  type LinkTask
} from '../src/main/tracking/import/work-task-links'

const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const root = join(home, 'CentralCommand')
const databaseFile = join(root, 'data', 'central-command.sqlite')
const workDir = join(root, 'time', 'work')
const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}
if (!existsSync(databaseFile)) fail(`No database at ${databaseFile}`)
if (!existsSync(workDir)) fail(`No Work hours at ${workDir}`)

const db = new Database(databaseFile, { readonly: true })
interface Row {
  uid: string
  title: string
  earlier_minutes: number
  due: string | null
  created_at: string
}
const rows = db
  .prepare(
    `SELECT t.uid, t.title, t.earlier_minutes, t.due, t.created_at
       FROM tasks t WHERE t.workspace = 'work' AND t.deleted_at IS NULL`
  )
  .all() as Row[]
const tasks: LinkTask[] = rows.map((r) => ({
  uid: r.uid,
  title: r.title,
  minutes: r.earlier_minutes,
  date: (r.due ?? r.created_at).slice(0, 10)
}))

const entries: LinkEntry[] = []
const linkedMinutes = new Map<string, number>()
let alreadyLinked = 0
for (const file of readdirSync(workDir).filter((f) => f.endsWith('.json'))) {
  const year = parseYear(JSON.parse(readFileSync(join(workDir, file), 'utf8')))
  if (!year) fail(`${file} is not a readable year file`)
  for (const a of year!.adjusts) {
    if (a.task) {
      alreadyLinked++
      if (a.earlier) linkedMinutes.set(a.task, (linkedMinutes.get(a.task) ?? 0) + a.minutes)
    } else
      entries.push({
        key: `${year!.start}/${a.id}`,
        date: a.date,
        label: a.label,
        minutes: a.minutes
      })
  }
}
// A task whose history is already linked and adds up is finished; one that is only partly linked is left for the plan.
const finished = (t: LinkTask): boolean => linkedMinutes.get(`cc://task/${t.uid}`) === t.minutes
tasks.splice(0, tasks.length, ...tasks.filter((t) => !finished(t)))

const plan = planTaskLinks(tasks, entries)
const h = formatHours
const line = (e: LinkEntry): string =>
  `${e.date}  ${h(e.minutes).padStart(5)}  ${e.label.slice(0, 70)}`
const total = (es: LinkEntry[]): number => es.reduce((a, e) => a + e.minutes, 0)

console.log(`Library   : ${root}`)
console.log('Mode      : dry run (nothing is written)\n')
console.log(
  `Work tasks ${tasks.length} (${tasks.filter((t) => t.minutes > 0).length} with time); entries to match ${entries.length} (${h(total(entries))}); entries already linked ${alreadyLinked}\n`
)

for (const confidence of ['high', 'medium', 'low'] as const) {
  const group = plan.links.filter((l) => l.confidence === confidence)
  console.log(
    `=== ${confidence} confidence: ${group.length} tasks, ${group.reduce((a, l) => a + l.entries.length, 0)} entries`
  )
  for (const l of group) {
    console.log(`${h(l.task.minutes).padStart(6)}  ${l.task.title}   [due ${l.task.date}]`)
    for (const e of l.entries) console.log(`          <- ${line(e)}`)
  }
  console.log('')
}
const linkedEntries = plan.links.flatMap((l) => l.entries)
console.log(
  `LINKED: ${plan.links.length} tasks, ${linkedEntries.length} of ${entries.length} entries, ${h(total(linkedEntries))} of ${h(total(entries))}`
)
console.log(
  `Every task's entries add up to its ClickUp time exactly: ${plan.links.every((l) => total(l.entries) === l.task.minutes) ? 'yes' : 'NO'}\n`
)

if (plan.ambiguous.length > 0) {
  console.log(`=== Tasks with two equally good sets (left alone): ${plan.ambiguous.length}`)
  for (const a of plan.ambiguous) {
    console.log(`${h(a.task.minutes).padStart(6)}  ${a.task.title}   [due ${a.task.date}]`)
    a.sets.forEach((s, i) =>
      console.log(`          ${i + 1}. ${s.map((e) => `${e.date} ${h(e.minutes)}`).join(', ')}`)
    )
  }
  console.log('')
}
console.log(`=== Tasks with time that no entries add up to (left alone): ${plan.unmatched.length}`)
for (const t of plan.unmatched)
  console.log(`${h(t.minutes).padStart(6)}  ${t.title}   [due ${t.date}]`)
const left = entries.filter((e) => !linkedEntries.includes(e))
console.log(`\n=== Entries linked to nothing: ${left.length} (${h(total(left))})`)

const apply = process.argv.includes('--apply')
if (!apply) process.exit(0)

const chosen = plan.links.filter(
  (l) => l.confidence !== 'low' || process.argv.includes('--include-low')
)
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = join(root, 'backups', `work-task-links-${stamp}`)
cpSync(workDir, backup, { recursive: true })
console.log(`\nBacked up ${workDir} to ${backup}`)

const now = nowMoment()
const store = new TrackingStore(join(root, 'time'), { starts: () => [], now: () => now })
const byYear = new Map<string, { id: string; uid: string }[]>()
for (const l of chosen)
  for (const e of l.entries) {
    const [start, id] = e.key.split('/')
    byYear.set(start, [...(byYear.get(start) ?? []), { id, uid: l.task.uid }])
  }
const before = new Map<string, number>()
for (const start of byYear.keys())
  before.set(start, yearMinutes(store.get('work', start), undefined, now))
for (const [start, links] of byYear) {
  const result = store.linkHistory('work', start, links)
  console.log(
    result.ok
      ? `Linked ${links.length} entries in ${start}.`
      : `Skipped ${start}: ${result.reason}, nothing changed.`
  )
}

// Read the files back, independent of the plan.
let problems = 0
for (const [start] of byYear) {
  const year = parseYear(JSON.parse(readFileSync(join(workDir, `${start}.json`), 'utf8')))
  if (!year) {
    console.log(`PROBLEM: ${start} cannot be read back`)
    problems++
    continue
  }
  if (yearMinutes(year, undefined, now) !== before.get(start)) {
    console.log(`PROBLEM: ${start} total changed`)
    problems++
  }
}
for (const l of chosen) {
  let sum = 0
  for (const file of readdirSync(workDir).filter((f) => f.endsWith('.json'))) {
    const year = parseYear(JSON.parse(readFileSync(join(workDir, file), 'utf8')))
    for (const a of year?.adjusts ?? [])
      if (a.earlier && a.task === `cc://task/${l.task.uid}`) sum += a.minutes
  }
  if (sum !== l.task.minutes) {
    console.log(`PROBLEM: ${l.task.title} reads back ${h(sum)}, not ${h(l.task.minutes)}`)
    problems++
  }
}
console.log(
  problems === 0
    ? `Read back: all ${chosen.length} tasks match, year totals unchanged.`
    : `${problems} PROBLEMS: restore from ${backup}`
)
