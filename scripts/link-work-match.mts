/**
 * Make every task's ClickUp time equal its hours. A task that holds typed hours but less ClickUp time (new tasks, tasks that had
 * none) has its ClickUp time raised to those hours, and its entries and timer sessions are marked as held by it (`earlier`). Tasks that
 * already match are not touched.
 *
 *   npm run link:work-match              # dry run
 *   npm run link:work-match -- --apply   # app closed; backs up the hours and the database first, reads everything back
 */
import { execSync } from 'child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { openDatabase } from '../src/main/db/connection'
import { TrackingStore } from '../src/main/tracking/store'
import { nowMoment } from '../src/shared/time'
import { parseYear } from '../src/shared/tracking/parse'
import { reportedMinutes } from '../src/shared/tracking/rounding'
import { formatHours } from '../src/shared/tracking/format'
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
const h = formatHours
const db = apply ? openDatabase(databaseFile) : new Database(databaseFile, { readonly: true })
const tasks = new Map(
  (
    db
      .prepare(
        "SELECT uid, title, earlier_minutes FROM tasks WHERE workspace = 'work' AND deleted_at IS NULL"
      )
      .all() as { uid: string; title: string; earlier_minutes: number }[]
  ).map((t) => [t.uid, t])
)

interface Typed {
  year: string
  id: string
  minutes: number
  earlier: boolean
}
const typed = new Map<string, Typed[]>()
const files = readdirSync(workDir)
  .filter((f) => f.endsWith('.json'))
  .sort()
for (const file of files) {
  const year = parseYear(JSON.parse(readFileSync(join(workDir, file), 'utf8')))
  if (!year) fail(`${file} is not a readable year file`)
  for (const a of year!.adjusts) {
    if (!a.task || a.minutes <= 0) continue
    const uid = a.task.replace('cc://task/', '')
    typed.set(uid, [
      ...(typed.get(uid) ?? []),
      { year: year!.start, id: a.id, minutes: a.minutes, earlier: a.earlier === true }
    ])
  }
  for (const x of year!.sessions) {
    const minutes = x.end === null ? 0 : reportedMinutes(x)
    if (!x.task || minutes <= 0) continue
    const uid = x.task.replace('cc://task/', '')
    typed.set(uid, [
      ...(typed.get(uid) ?? []),
      { year: year!.start, id: x.id, minutes, earlier: x.earlier === true }
    ])
  }
}

const todo: { uid: string; title: string; from: number; to: number; ids: Typed[] }[] = []
for (const [uid, list] of typed) {
  const task = tasks.get(uid)
  if (!task) fail(`An entry points at a task that is missing or in the trash: ${uid}`)
  const hours = list.reduce((a, e) => a + e.minutes, 0)
  const held = list.filter((e) => e.earlier).reduce((a, e) => a + e.minutes, 0)
  if (held === hours && task!.earlier_minutes === hours) continue
  if (task!.earlier_minutes !== held)
    fail(
      `${task!.title}: ClickUp ${h(task!.earlier_minutes)} but ${h(held)} of its hours are held by it; not handled`
    )
  todo.push({
    uid,
    title: task!.title,
    from: task!.earlier_minutes,
    to: hours,
    ids: list.filter((e) => !e.earlier)
  })
}
const added = todo.reduce((a, t) => a + (t.to - t.from), 0)
console.log(`Library: ${root}\nMode   : ${apply ? 'APPLY' : 'dry run (nothing is written)'}\n`)
console.log(
  `${todo.length} tasks get their ClickUp time raised to their hours, ${h(added)} in all:`
)
for (const t of todo)
  console.log(
    `  ${h(t.from).padStart(6)} -> ${h(t.to).padStart(6)}  ${t.title}  (${t.ids.length} entries)`
  )
if (!apply) process.exit(0)

try {
  const running = execSync('pgrep -fl "Central Command|central-command" || true', {
    encoding: 'utf8'
  })
    .split('\n')
    .filter((l) => l && !/link-work-match|pgrep/.test(l))
  if (running.length > 0 && !process.env.CENTRAL_COMMAND_HOME)
    fail(`Close the app first:\n${running.join('\n')}`)
} catch {
  // pgrep not available: carry on
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = join(root, 'backups', `work-match-${stamp}`)
mkdirSync(backup, { recursive: true })
cpSync(workDir, join(backup, 'work'), { recursive: true })
db.prepare('VACUUM INTO ?').run(join(backup, 'central-command.sqlite'))
console.log(`\nBacked up to ${backup}`)
const now = new Date().toISOString()
const set = db.prepare('UPDATE tasks SET earlier_minutes = ?, updated_at = ? WHERE uid = ?')
db.transaction(() => {
  for (const t of todo) set.run(t.to, now, t.uid)
})()
const tracking = new TrackingStore(join(root, 'time'), { starts: () => [], now: () => nowMoment() })
const byYear = new Map<string, string[]>()
for (const t of todo)
  for (const e of t.ids) byYear.set(e.year, [...(byYear.get(e.year) ?? []), e.id])
for (const [start, ids] of byYear) {
  const r = tracking.markEarlier('work', start, ids)
  if (!r.ok) fail(`Could not mark the hours of ${start}: ${r.reason}. Restore from ${backup}`)
  console.log(`Marked ${ids.length} entries in ${start}.`)
}

// Read back, independent of the plan.
const bad: string[] = []
const live = new Map(
  (
    db
      .prepare(
        "SELECT uid, title, earlier_minutes FROM tasks WHERE workspace = 'work' AND deleted_at IS NULL"
      )
      .all() as { uid: string; title: string; earlier_minutes: number }[]
  ).map((t) => [t.uid, t])
)
const held = new Map<string, number>()
const all = new Map<string, number>()
for (const file of files) {
  const year = parseYear(JSON.parse(readFileSync(join(workDir, file), 'utf8')))!
  for (const a of year.adjusts) {
    if (!a.task || a.minutes <= 0) continue
    const uid = a.task.replace('cc://task/', '')
    all.set(uid, (all.get(uid) ?? 0) + a.minutes)
    if (a.earlier) held.set(uid, (held.get(uid) ?? 0) + a.minutes)
  }
  for (const x of year.sessions) {
    const minutes = x.end === null ? 0 : reportedMinutes(x)
    if (!x.task || minutes <= 0) continue
    const uid = x.task.replace('cc://task/', '')
    all.set(uid, (all.get(uid) ?? 0) + minutes)
    if (x.earlier) held.set(uid, (held.get(uid) ?? 0) + minutes)
  }
}
for (const [uid, hours] of all) {
  const t = live.get(uid)
  if (!t || t.earlier_minutes !== hours || (held.get(uid) ?? 0) !== hours)
    bad.push(
      `${t?.title ?? uid}: ClickUp ${h(t?.earlier_minutes ?? 0)}, typed hours ${h(hours)}, held ${h(held.get(uid) ?? 0)}`
    )
}
const snapshot = writeTasksSnapshot(
  db,
  join(root, 'backups', 'tasks'),
  new Date(),
  'after-matching-clickup-to-hours'
)
db.close()
if (bad.length > 0) {
  console.log(`\n${bad.length} PROBLEMS; restore from ${backup}:`)
  for (const b of bad) console.log(`  ${b}`)
  process.exit(1)
}
console.log(
  `\nRead back: every task that holds typed hours has exactly that much ClickUp time. A readable copy: ${snapshot}`
)
