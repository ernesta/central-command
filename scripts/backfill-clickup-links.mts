/**
 * One-off backfill: the task descriptions (mostly links) that the ClickUp CSV export dropped.
 *
 *   CLICKUP_API_TOKEN=pk_… npm run backfill:clickup-links            # dry run: the report, nothing written
 *   CLICKUP_API_TOKEN=pk_… npm run backfill:clickup-links -- --apply # writes the descriptions (app closed)
 *
 * The export's `Task Content` column holds ClickUp's plain-text rendering, which is empty whenever a description is
 * nothing but rich content (a link embed). The API keeps the real thing in `markdown_description`.
 *
 * ClickUp is only read, never written to. Descriptions come 100 tasks a page from the workspace-wide endpoint, so the
 * whole library costs about thirty requests against a limit of 100 a minute. A description we already hold is never
 * overwritten, so the 89 the CSV did carry (and anything typed since) stay as they are. `--apply` copies the database
 * to `~/CentralCommand/backups/clickup-links-<time>/` first, writes through the store, then reads every change back.
 */
import { existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { openDatabase } from '../src/main/db/connection'
import {
  planDescriptionBackfill,
  type FetchedDescriptions,
  type StoredTask
} from '../src/modules/tasks/main/import/clickup-descriptions'
import { TasksStore } from '../src/modules/tasks/main/tasks-store'
import { writeTasksSnapshot } from '../src/modules/tasks/main/snapshot'

/** ClickUp's API. CLICKUP_API_BASE points the script at a stand-in, which is how the fetching is tested. */
const API = process.env.CLICKUP_API_BASE || 'https://api.clickup.com/api/v2'
/** A pause between requests: well inside 100 a minute, and gentle if the limit is ever shared. */
const GAP_MS = 350

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const apply = process.argv.includes('--apply')
const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}
const nf = (n: number): string => n.toLocaleString('en-GB')
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const token = process.env.CLICKUP_API_TOKEN
if (!token) {
  fail(
    'Set CLICKUP_API_TOKEN first (ClickUp: Settings -> Apps -> API Token).\n' +
      '  CLICKUP_API_TOKEN=pk_… npm run backfill:clickup-links'
  )
}
const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const root = join(home, 'CentralCommand')
const databaseFile = join(root, 'data', 'central-command.sqlite')
if (!existsSync(databaseFile)) fail(`No library at ${databaseFile}`)

let requests = 0

/** One GET, with the rate limit respected: a 429 waits for the window ClickUp names and tries again. */
async function get(path: string, attempt = 0): Promise<Record<string, unknown>> {
  requests += 1
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: token as string, 'Content-Type': 'application/json' }
  })
  if (response.status === 429) {
    if (attempt >= 4)
      fail('\nClickUp is still rate-limiting after four waits; nothing was written.')
    const reset = Number(response.headers.get('X-RateLimit-Reset'))
    const waitMs = Number.isFinite(reset) ? Math.max(1000, reset * 1000 - Date.now()) : 60_000
    console.log(`  rate-limited, waiting ${Math.ceil(waitMs / 1000)}s …`)
    await sleep(Math.min(waitMs, 90_000))
    return get(path, attempt + 1)
  }
  if (!response.ok) {
    fail(`\nClickUp said ${response.status} for ${path}:\n${(await response.text()).slice(0, 500)}`)
  }
  return (await response.json()) as Record<string, unknown>
}

interface ApiTask {
  id: string
  markdown_description?: string
  description?: string
}

async function teamId(): Promise<string> {
  const given = arg('team')
  if (given) return given
  const teams = (await get('/team')).teams as { id: string; name: string }[] | undefined
  if (!teams || teams.length === 0) fail('ClickUp returned no workspaces for this token.')
  const list = teams as { id: string; name: string }[]
  if (list.length > 1) {
    console.log('Several workspaces; pick one with --team <id>:')
    for (const t of list) console.log(`  ${t.id}  ${t.name}`)
    process.exit(1)
  }
  console.log(`Workspace: ${list[0].name} (${list[0].id})`)
  return list[0].id
}

/** Every task in the workspace, 100 a page, descriptions included. Archived tasks are a second pass. */
async function fetchDescriptions(team: string): Promise<FetchedDescriptions> {
  const found: FetchedDescriptions = new Map()
  for (const archived of [false, true]) {
    for (let page = 0; ; page += 1) {
      const query = new URLSearchParams({
        page: String(page),
        include_markdown_description: 'true',
        include_closed: 'true',
        subtasks: 'true',
        archived: String(archived)
      })
      const body = await get(`/team/${team}/task?${query.toString()}`)
      const tasks = (body.tasks ?? []) as ApiTask[]
      for (const t of tasks) found.set(t.id, t.markdown_description ?? t.description ?? '')
      process.stdout.write(
        `\r  ${archived ? 'archived' : 'tasks'}: page ${page + 1}, ${nf(found.size)} tasks so far   `
      )
      if (body.last_page === true || tasks.length === 0) break
      await sleep(GAP_MS)
    }
    process.stdout.write('\n')
  }
  return found
}

const db = openDatabase(databaseFile)
const held = db
  .prepare(
    `SELECT uid, source_id AS sourceId, title, description FROM tasks
      WHERE source_id IS NOT NULL AND deleted_at IS NULL ORDER BY title`
  )
  .all() as StoredTask[]
console.log(`Library: ${databaseFile}`)
console.log(`Tasks carrying a ClickUp id: ${nf(held.length)}`)

const team = await teamId()
console.log('\nFetching descriptions (100 a page):')
const fetched = await fetchDescriptions(team)
console.log(`ClickUp returned ${nf(fetched.size)} tasks in ${requests} requests.`)

const plan = planDescriptionBackfill(held, fetched)
const links = plan.changes.filter((c) => c.kind === 'link')
const texts = plan.changes.filter((c) => c.kind === 'text')

console.log(`\nAlready hold a description, left alone : ${nf(plan.kept)}`)
console.log(`Empty here and empty in ClickUp too    : ${nf(plan.empty)}`)
console.log(`To fill in                             : ${nf(plan.changes.length)}`)
console.log(`  a bare link : ${nf(links.length)}`)
console.log(`  text too    : ${nf(texts.length)}`)

if (links.length > 0) {
  console.log('\nLINKS to fill in:')
  for (const c of links) console.log(`  ${c.title}\n      ${c.description}`)
}
if (texts.length > 0) {
  console.log('\nTEXT to fill in (read these):')
  for (const c of texts) {
    console.log(`  ${c.title}`)
    for (const line of c.description.split('\n')) console.log(`      ${line}`)
  }
}
if (plan.missing.length > 0) {
  console.log(
    `\nHeld here but not returned by ClickUp (deleted there, or out of reach): ${plan.missing.length}`
  )
  for (const id of plan.missing) {
    console.log(`  ${id}  ${held.find((t) => t.sourceId === id)?.title ?? ''}`)
  }
  console.log('  These keep the descriptions they have; nothing is guessed.')
}

if (!apply) {
  db.close()
  console.log('\nDry run: nothing was written. Add --apply to write them (with the app closed).')
  process.exit(0)
}
if (plan.changes.length === 0) {
  db.close()
  console.log('\nNothing to write.')
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = join(root, 'backups', `clickup-links-${stamp}`)
mkdirSync(backup, { recursive: true })
db.prepare('VACUUM INTO ?').run(join(backup, 'central-command.sqlite'))
console.log(`\nBacked up to ${backup}`)

const store = new TasksStore(db)
db.transaction(() => {
  for (const c of plan.changes) store.update(c.uid, { description: c.description })
})()

const wrong = plan.changes.filter((c) => store.get(c.uid)?.description !== c.description)
const snapshot = writeTasksSnapshot(db, join(root, 'backups', 'tasks'), new Date(), 'clickup-links')
db.close()
if (wrong.length > 0) {
  console.log(
    `\nPROBLEM: ${wrong.length} description(s) did not read back; restore from ${backup}:`
  )
  for (const c of wrong) console.log(`  ${c.title}`)
  process.exit(1)
}
console.log(`\nApplied: ${nf(plan.changes.length)} descriptions written and read back.`)
console.log(`A readable copy: ${snapshot}`)
