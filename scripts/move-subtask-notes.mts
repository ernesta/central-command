/**
 * One-off (7 Oct 2026): subtasks have no page, so a subtask's note moves into its parent's description as a "### <subtask title>"
 * section after the existing text, and the subtask's own description is cleared. Never overwrites (a parent's text only grows).
 *
 *   npm run move:subtask-notes              # dry run: prints every change
 *   npm run move:subtask-notes -- --apply   # app closed; backs up the database first, reads everything back
 */
import { existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { openDatabase } from '../src/main/db/connection'
import {
  appendSection,
  applyNoteMoves,
  findNoteMoves
} from '../src/modules/tasks/main/subtask-notes'
import { writeTasksSnapshot } from '../src/modules/tasks/main/snapshot'

const apply = process.argv.includes('--apply')
const root = join(
  assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir()),
  'CentralCommand'
)
const databaseFile = join(root, 'data', 'central-command.sqlite')
if (!existsSync(databaseFile)) {
  console.error(`No library under ${root}`)
  process.exit(1)
}
const db = apply ? openDatabase(databaseFile) : new Database(databaseFile, { readonly: true })

const moves = findNoteMoves(db)
const parents = new Set(moves.map((m) => m.parentUid))
console.log(`Subtask notes to move: ${moves.length}, under ${parents.size} parents`)
const text = new Map<string, string>()
const current = (uid: string): string =>
  text.get(uid) ??
  (db.prepare('SELECT description FROM tasks WHERE uid = ?').get(uid) as { description: string })
    .description
for (const m of moves) {
  const before = current(m.parentUid)
  const after = appendSection(before, m.kidTitle, m.note)
  text.set(m.parentUid, after)
  console.log(`\n== ${m.parentTitle || 'Untitled'}  <-  ${m.kidTitle || 'Untitled'}`)
  console.log(
    `   parent text before: ${before.trim() === '' ? '(empty)' : `${before.length} characters`}`
  )
  console.log(
    after
      .slice(before.replace(/\s+$/, '').length)
      .replace(/^\n+/, '')
      .split('\n')
      .map((l) => `   + ${l}`)
      .join('\n')
  )
}
if (!apply) {
  console.log('\nDry run: nothing changed. Add --apply (app closed) to do it.')
  process.exit(0)
}
if (moves.length === 0) {
  console.log('\nNothing to move.')
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = join(root, 'backups', `move-subtask-notes-${stamp}`)
mkdirSync(backup, { recursive: true })
db.prepare('VACUUM INTO ?').run(join(backup, 'central-command.sqlite'))
console.log(`\nBacked up to ${backup}`)

applyNoteMoves(db, moves)

const bad: string[] = []
const again = findNoteMoves(db)
if (again.length > 0) bad.push(`${again.length} notes still on subtasks`)
for (const [uid, expected] of text) {
  const row = db.prepare('SELECT description FROM tasks WHERE uid = ?').get(uid) as {
    description: string
  }
  if (row.description !== expected) bad.push(`${uid} does not hold the planned text`)
}
const snapshot = writeTasksSnapshot(
  db,
  join(root, 'backups', 'tasks'),
  new Date(),
  'after-move-subtask-notes'
)
db.close()
if (bad.length > 0) {
  console.log(`\nPROBLEMS; restore from ${backup}:`)
  for (const b of bad) console.log(`  ${b}`)
  process.exit(1)
}
console.log(`\nRead back: all as planned. A readable copy: ${snapshot}`)
