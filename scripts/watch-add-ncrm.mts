/**
 * Adds to Watch (Research) NCRM's course listing as a source: the feed of its training database filtered to NCRM and partner courses
 * (the home page holds news and one featured course, not the calendar). Titles end "(dd/mm/yy)", which the feed reader turns into the
 * date. Idempotent: a source whose address is already there is skipped.
 *
 *   npm run watch:add-ncrm
 *   npm run watch:add-ncrm -- --apply   # app closed; backs the database up first, then adds it
 */ import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { openDatabase } from '../src/main/db/connection'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { runMigrations } from '../src/main/db/migrate'
import { checkSource } from '../src/modules/watch/main/checker'
import { watchMigrationsFromDir } from '../src/modules/watch/main/migration-files'
import { makeNetFetcher } from '../src/modules/watch/main/net-fetcher'
import { addSource, listItems } from '../src/modules/watch/main/repository'
import type { NewWatchSource } from '../src/modules/watch/shared/types'

const apply = process.argv.includes('--apply')
const now = new Date().toISOString()

const SOURCES: NewWatchSource[] = [
  [
    'NCRM: Training courses and events',
    'https://www.ncrm.ac.uk/training/rss/rss.php?id=8422537dbd9480b9965ad1d821456d6c'
  ]
].map(([title, url]) => ({
  workspace: 'research',
  title,
  url,
  method: 'feed',
  intervalHours: 24
}))

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
const sourcesToAdd = SOURCES.filter((s) => !haveSource(s.url))
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

scratch.close()

if (!apply) {
  console.log(
    `\nDry run: nothing changed. ${sourcesToAdd.length} source(s) would be added. Add --apply (app closed) to add them.`
  )
  process.exit(0)
}

const backups = join(root, 'backups', `watch-ncrm-${now.replace(/[:.]/g, '-')}`)
mkdirSync(backups, { recursive: true })
copyFileSync(databaseFile, join(backups, 'central-command.sqlite'))
const db = openDatabase(databaseFile)
try {
  runMigrations(db, migrations)
  for (const s of sourcesToAdd) addSource(db, s, now)
  console.log(`\nAdded ${sourcesToAdd.length} source(s). Backup: ${backups}`)
} finally {
  db.close()
}
