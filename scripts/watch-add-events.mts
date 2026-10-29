/**
 * Adds to Watch (Research) the three LINGUIST List sources and the Jacobs Foundation BOLD fellowship as an entry by hand
 * (`docs/WATCH_EVENTS_PLAN.md`, "Sources to add"). Idempotent: a source whose address is already there, or an entry whose link is
 * already there, is skipped.
 *
 *   npm run watch:add-events
 *   npm run watch:add-events -- --apply   # app closed; backs the database up first, then adds them
 *
 * The dry run reads each page once through the app's own fetcher into a throwaway database (the library is opened read-only) and
 * reports what each found, by section, so a wrong sort can be seen before anything is added. Nothing it reads is stored.
 */
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { openDatabase } from '../src/main/db/connection'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { runMigrations } from '../src/main/db/migrate'
import { checkSource } from '../src/modules/watch/main/checker'
import { readEntryLink } from '../src/modules/watch/main/entry-link'
import { watchMigrationsFromDir } from '../src/modules/watch/main/migration-files'
import { makeNetFetcher } from '../src/modules/watch/main/net-fetcher'
import { addSource, createManualItem, listItems } from '../src/modules/watch/main/repository'
import type { ManualItemInput, NewWatchSource } from '../src/modules/watch/shared/types'

const apply = process.argv.includes('--apply')
const now = new Date().toISOString()
const today = now.slice(0, 10)

const SOURCES: NewWatchSource[] = [
  {
    workspace: 'research',
    title: 'LINGUIST List: Conferences',
    url: 'https://linguistlist.org/issues/rss/confs',
    method: 'feed',
    intervalHours: 24
  },
  {
    workspace: 'research',
    title: 'LINGUIST List: Calls',
    url: 'https://linguistlist.org/issues/rss/calls',
    method: 'feed',
    intervalHours: 24
  },
  {
    workspace: 'research',
    title: 'LINGUIST List: Summer schools',
    url: 'https://linguistlist.org/issues/?topic=Summer%20Schools',
    method: 'page',
    intervalHours: 24
  }
]

const JACOBS: ManualItemInput = {
  workspace: 'research',
  title: 'BOLD Science Communication Fellowship',
  section: 'opportunity',
  url: 'https://jacobsfoundation.org/bold-celebrates-its-10th-birthday-by-launching-the-science-communication-fellowship/',
  summary:
    'Six-month fellowship for early-career researchers in child learning and development; CHF 5,000 stipend.',
  eventDate: '2026-09-01',
  eventEnd: '2026-10-31',
  deadline: '2026-10-31',
  deadlineLabel: 'Apply by'
}

const root = join(
  assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir()),
  'CentralCommand'
)
const databaseFile = join(root, 'data', 'central-command.sqlite')
if (!existsSync(databaseFile)) {
  console.error(`No library under ${root}`)
  process.exit(1)
}
const migrations = watchMigrationsFromDir(join(process.cwd(), 'src/modules/watch/main/migrations'))

// What the library already has (read-only; the tables may not exist yet).
const reader = new Database(databaseFile, { readonly: true })
const has = (sql: string, value: string): boolean => {
  try {
    return reader.prepare(sql).get(value) !== undefined
  } catch {
    return false
  }
}
const haveSource = (url: string): boolean => has('SELECT 1 FROM watch_sources WHERE url = ?', url)
const haveEntry = (url: string): boolean => has('SELECT 1 FROM watch_items WHERE url = ?', url)
const sourcesToAdd = SOURCES.filter((s) => !haveSource(s.url))
const addEntry = !haveEntry(JACOBS.url as string)
reader.close()

// The app's own fetcher around Node's fetch (the app uses Electron's net.fetch).
const fetcher = makeNetFetcher((url, init) => fetch(url, init))

console.log('Sources (Research, every 24 hours):')
const scratch = new Database(':memory:')
scratch.pragma('foreign_keys = ON')
runMigrations(scratch, migrations)
for (const s of SOURCES) {
  console.log(`\n  ${haveSource(s.url) ? '= already there' : '+'} ${s.title}\n      ${s.url}`)
  const source = addSource(scratch, s, now)
  const outcome = await checkSource(scratch, source, fetcher, now)
  if (outcome.status === 'error') {
    console.log(`      could not be read: ${outcome.error}`)
    continue
  }
  const items = listItems(scratch, { sourceId: source.id, limit: 1000 })
  const by = (section: string): typeof items => items.filter((i) => i.section === section)
  console.log(
    `      read: ${items.length} item(s): ${by('training').length} training, ${by('conference').length} conference, ${by('opportunity').length} opportunity`
  )
  for (const section of ['training', 'conference', 'opportunity'])
    for (const i of by(section).slice(0, 40))
      console.log(
        `        [${section}] ${i.title.slice(0, 100)}${i.eventDate ? `  (${i.eventDate}${i.eventEnd ? ` to ${i.eventEnd}` : ''})` : ''}${i.deadline ? `  deadline ${i.deadline}` : ''}`
      )
}

console.log(
  `\nEntry by hand (Opportunity, Saved): ${JACOBS.title}${addEntry ? '' : '  = already there'}`
)
const read = await readEntryLink(JACOBS.url as string, fetcher, today)
console.log(
  `  the app read the link: ${read.notice ?? 'ok'}\n    title:    ${read.title}\n    section:  ${read.section}\n    summary:  ${read.summary}\n    dates:    ${read.eventDate ?? '-'} to ${read.eventEnd ?? '-'}; deadline ${read.deadline ?? '-'} (${read.deadlineLabel ?? '-'})`
)
console.log(
  `  stored as given: ${JACOBS.section}, ${JACOBS.eventDate} to ${JACOBS.eventEnd}, deadline ${JACOBS.deadline}`
)
scratch.close()

if (!apply) {
  console.log(
    `\nDry run: nothing changed. ${sourcesToAdd.length} source(s) and ${addEntry ? 1 : 0} entry would be added. Add --apply (app closed) to add them.`
  )
  process.exit(0)
}

const backups = join(root, 'backups', `watch-events-${now.replace(/[:.]/g, '-')}`)
mkdirSync(backups, { recursive: true })
copyFileSync(databaseFile, join(backups, 'central-command.sqlite'))
const db = openDatabase(databaseFile)
try {
  runMigrations(db, migrations)
  for (const s of sourcesToAdd) addSource(db, s, now)
  if (addEntry) createManualItem(db, JACOBS, now)
  console.log(
    `\nAdded ${sourcesToAdd.length} source(s) and ${addEntry ? 1 : 0} entry. Backup: ${backups}`
  )
} finally {
  db.close()
}
