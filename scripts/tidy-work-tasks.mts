/**
 * One-off (7 Oct 2026 round): (1) splits Work's "Luminos" list into one list per client (Impact, Teaching & Learning) by the client of
 * the task's hours (most minutes; a task without hours by its due date and sublist, see `clientFor`); sublists stay. (2) Sets every Work
 * task that has hours to be due on its latest hours entry. (3) Makes the unfinished ones (to do) "in progress".
 *
 *   npm run tidy:work-tasks              # dry run
 *   npm run tidy:work-tasks -- --apply   # app closed; backs up the database first, reads everything back
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { openDatabase } from '../src/main/db/connection'
import { parseYear } from '../src/shared/tracking/parse'
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

const FIRST_CONTRACT_ENDS = '2026-04-30'
const CLIENTS = ['Impact', 'Teaching & Learning']

interface Hours {
  minutes: number
  latest: string
  byClient: Map<string, number>
}
const hours = new Map<string, Hours>()
for (const file of readdirSync(workDir).filter((f) => f.endsWith('.json'))) {
  const year = parseYear(JSON.parse(readFileSync(join(workDir, file), 'utf8')))
  if (!year) fail(`${file} is not a readable year file`)
  for (const x of [...year!.adjusts, ...year!.sessions]) {
    if (!x.task) continue
    const uid = x.task.replace('cc://task/', '')
    const h = hours.get(uid) ?? { minutes: 0, latest: '', byClient: new Map() }
    h.minutes += x.minutes ?? 0
    if (x.date > h.latest) h.latest = x.date
    const client = x.client ?? ''
    h.byClient.set(client, (h.byClient.get(client) ?? 0) + (x.minutes ?? 0))
    hours.set(uid, h)
  }
}

interface Row {
  uid: string
  title: string
  status: string
  due: string | null
  list: string
  sublist: string
  parent_uid: string | null
}
const rows = db
  .prepare(
    "SELECT uid, title, status, due, list, sublist, parent_uid FROM tasks WHERE workspace = 'work' AND deleted_at IS NULL"
  )
  .all() as Row[]

const mostMinutes = (h: Hours): string =>
  [...h.byClient.entries()]
    .filter(([c]) => CLIENTS.includes(c))
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''

// A task with hours goes by them. One without goes by its due date (before the second contract: Impact), else by what the rest of its
// sublist holds.
const luminos = rows.filter((r) => r.list === 'Luminos')
const bySublist = new Map<string, Map<string, number>>()
for (const r of luminos) {
  const h = hours.get(r.uid)
  if (!h) continue
  const m = bySublist.get(r.sublist) ?? new Map<string, number>()
  m.set(mostMinutes(h), (m.get(mostMinutes(h)) ?? 0) + 1)
  bySublist.set(r.sublist, m)
}
function clientFor(r: Row): { client: string; how: string } {
  const h = hours.get(r.uid)
  if (h && mostMinutes(h))
    return { client: mostMinutes(h), how: h.byClient.size > 1 ? 'mixed hours' : 'hours' }
  if (r.due && r.due <= FIRST_CONTRACT_ENDS) return { client: 'Impact', how: 'due date' }
  const m = [...(bySublist.get(r.sublist) ?? new Map<string, number>()).entries()].sort(
    (a, b) => b[1] - a[1]
  )[0]
  return { client: m?.[0] ?? CLIENTS[0], how: 'sublist' }
}

const moves = luminos.map((r) => ({ r, ...clientFor(r) }))
const dues = rows
  .filter((r) => hours.has(r.uid) && r.due !== hours.get(r.uid)!.latest)
  .map((r) => ({ r, to: hours.get(r.uid)!.latest }))
const starts = rows.filter((r) => hours.has(r.uid) && r.status === 'todo')

console.log(`Luminos split: ${moves.length} tasks`)
for (const c of CLIENTS) console.log(`  ${c}: ${moves.filter((m) => m.client === c).length}`)
console.log('  Not decided by hours (check these):')
for (const m of moves.filter((m) => m.how !== 'hours'))
  console.log(`    ${m.client} (${m.how}): ${m.r.title} [${m.r.sublist}]`)
console.log(`Due dates set to the latest hours entry: ${dues.length}`)
console.log(`To do -> in progress (have hours): ${starts.length}`)
for (const r of starts) console.log(`    ${r.title}`)
if (!apply) {
  console.log('\nDry run: nothing changed. Add --apply (app closed) to do it.')
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = join(root, 'backups', `tidy-work-tasks-${stamp}`)
mkdirSync(backup, { recursive: true })
db.prepare('VACUUM INTO ?').run(join(backup, 'central-command.sqlite'))
console.log(`\nBacked up to ${backup}`)

const store = new TasksStore(db)
for (const m of moves) store.update(m.r.uid, { list: m.client, sublist: m.r.sublist })
for (const d of dues) store.update(d.r.uid, { due: d.to })
for (const r of starts) store.setStatus(r.uid, 'doing')

const after = db
  .prepare(
    "SELECT uid, status, due, list FROM tasks WHERE workspace = 'work' AND deleted_at IS NULL"
  )
  .all() as { uid: string; status: string; due: string | null; list: string }[]
const bad: string[] = []
if (after.some((t) => t.list === 'Luminos')) bad.push('Luminos tasks remain')
for (const t of after) {
  const h = hours.get(t.uid)
  if (h && t.due !== h.latest) bad.push(`${t.uid} due ${t.due}`)
  if (h && t.status === 'todo') bad.push(`${t.uid} still to do`)
}
if (after.length !== rows.length) bad.push(`${after.length} tasks, expected ${rows.length}`)
const snapshot = writeTasksSnapshot(
  db,
  join(root, 'backups', 'tasks'),
  new Date(),
  'after-tidy-work-tasks'
)
db.close()
if (bad.length > 0) {
  console.log(`\nPROBLEMS; restore from ${backup}:`)
  for (const b of bad) console.log(`  ${b}`)
  process.exit(1)
}
console.log(`\nRead back: all as planned. A readable copy: ${snapshot}`)
