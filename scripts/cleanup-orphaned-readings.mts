/**
 * One-off catch-up (11 Oct 2026): deletes readings flagged `missing_from_source` that have
 * nothing attached (no notes, no Reading Lists mention, no `@` mention), the same rule
 * `applySync`'s stage-2 delete-if-unattached logic applies to a citekey newly found missing
 * (docs/READINGS_SYNC_PLAN.md). That logic never re-checks a row already flagged before it
 * shipped (9 Oct 2026) -- it assumes the invariant already holds -- so a row flagged earlier,
 * like the blank "Report" item that started the plan, stays orphaned forever. This is the
 * one-time sweep for those; a plain sync never needs it again once this has run.
 *
 *   npm run cleanup:orphaned-readings            # dry run: lists what it would delete
 *   npm run cleanup:orphaned-readings -- --apply # deletes them (app closed); backs up the database first
 */
import { existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { openDatabase } from '../src/main/db/connection'
import type { BacklinkFolder } from '../src/main/entities/backlinks'
import { collectMentionedReadingKeys } from '../src/main/entities/reading-mentions'
import { deleteOrphanedFlagged, findOrphanedFlagged } from '../src/modules/readings/main/repository'

const apply = process.argv.includes('--apply')
const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const root = join(home, 'CentralCommand')
const notes = join(root, 'notes')
const databaseFile = join(root, 'data', 'central-command.sqlite')
if (!existsSync(databaseFile)) {
  console.error(`No library at ${databaseFile}`)
  process.exit(1)
}

// The same folders `backlinkFolders` (`src/main/ipc/entities.ts`) lists, built by hand here
// instead of imported: that file also pulls in `ipcMain`/`shell` from `electron` at module scope
// for its IPC handlers, which this plain-Node script never needs and can't load.
const noteFiles = join(notes, 'notes')
const folders: BacklinkFolder[] = [
  { kind: 'note', workspace: 'life', dir: join(noteFiles, 'life') },
  ...(['research', 'work'] as const).flatMap((workspace): BacklinkFolder[] => [
    { kind: 'note', workspace, dir: join(noteFiles, workspace) },
    { kind: 'meeting', workspace, dir: join(notes, 'meetings', workspace) }
  ]),
  { kind: 'training', workspace: 'research', dir: join(notes, 'training', 'research') },
  { kind: 'reading-list', workspace: 'research', dir: join(notes, 'reading-lists', 'research') },
  { kind: 'reading-notes', workspace: 'research', dir: join(notes, 'readings') },
  { kind: 'plan', workspace: 'research', dir: join(notes, 'training-plans') }
]

const db = apply ? openDatabase(databaseFile) : new Database(databaseFile, { readonly: true })
const mentioned = await collectMentionedReadingKeys(db, folders)
const orphaned = findOrphanedFlagged(db, mentioned)

console.log(`Library: ${databaseFile}`)
if (orphaned.length === 0) {
  console.log(
    '\nNothing orphaned: every flagged "not in Zotero" reading has notes, a Reading Lists mention or an @ mention.'
  )
  db.close()
  process.exit(0)
}

console.log(`\n${orphaned.length} flagged reading(s) with nothing attached:`)
for (const r of orphaned) console.log(`  ${r.citekey}  ${r.shortCitation}`)

if (!apply) {
  db.close()
  console.log('\nDry run: nothing was deleted. Add --apply (app closed) to delete these.')
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = join(root, 'backups', `cleanup-orphaned-readings-${stamp}`)
mkdirSync(backup, { recursive: true })
db.prepare('VACUUM INTO ?').run(join(backup, 'central-command.sqlite'))
console.log(`\nBacked up to ${backup}`)

const deleted = deleteOrphanedFlagged(
  db,
  orphaned.map((r) => r.citekey)
)
db.close()
console.log(`\nDeleted ${deleted} of ${orphaned.length}.`)
if (deleted < orphaned.length) {
  console.log(
    '  Some gained notes or a mention between planning and applying, and were left alone -- re-run to see what remains.'
  )
}
