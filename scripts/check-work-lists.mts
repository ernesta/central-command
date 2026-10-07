/**
 * Report only: the live Work tasks whose top-level list is not one of the clients of a contract (the rule of
 * `docs/CLIENT_LISTS_PLAN.md`). Expected: none. Changes nothing (the database is opened read-only).
 *
 *   npm run check:work-lists
 */
import { existsSync, readdirSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { parseYear } from '../src/shared/tracking/parse'
import { outsideRule, workClients } from '../src/modules/tasks/shared/work-lists'

const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}
const root = join(
  assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir()),
  'CentralCommand'
)
const workDir = join(root, 'time', 'work')
const databaseFile = join(root, 'data', 'central-command.sqlite')
if (!existsSync(databaseFile) || !existsSync(workDir)) fail(`No Work library under ${root}`)

const plans = readdirSync(workDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => {
    const year = parseYear(JSON.parse(readFileSync(join(workDir, f), 'utf8')))
    return year ? year.plan : fail(`${f} is not a readable contract file`)
  })
const clients = workClients(plans)

const db = new Database(databaseFile, { readonly: true })
const tasks = db
  .prepare(
    "SELECT uid, title, list, sublist FROM tasks WHERE workspace = 'work' AND deleted_at IS NULL AND parent_uid IS NULL"
  )
  .all() as { uid: string; title: string; list: string; sublist: string }[]

console.log(`Work's clients (one list each): ${clients.join(', ') || 'none'}`)
for (const c of clients) {
  const n = tasks.filter((t) => t.list.toLowerCase() === c.toLowerCase()).length
  console.log(`  ${c}: ${n} tasks`)
}
const outside = outsideRule(tasks, clients)
if (outside.length === 0) {
  console.log('No Work task is outside the rule.')
} else {
  console.log(`\n${outside.length} Work task(s) in a list that is no client:`)
  for (const t of outside)
    console.log(`  [${t.list}${t.sublist ? ' › ' + t.sublist : ''}] ${t.title} (${t.uid})`)
  process.exitCode = 1
}
