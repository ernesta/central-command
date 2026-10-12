/**
 * One-off clean-up: write every list bullet as `-` (never `*` or `+`) in every note.
 *
 *   npm run standardise:bullets                 # dry run: lists the notes it would change, writes nothing
 *   npm run standardise:bullets -- --apply      # rewrites them (after copying each to a backup folder)
 *
 * Only list markers change (read from the Markdown syntax tree, so code, rules, emphasis and numbers stay), the front
 * matter is never touched, and each result is checked (same text but for those characters) before it is written; a
 * note that fails is left alone and reported. The Readings notes (`notes/readings/`) are never touched. Applying
 * copies every note it changes to `~/CentralCommand/backups/standardise-bullets-<time>/` first and writes with the
 * same content-hash guard as the app. Close the app before applying.
 */
import { mkdir } from 'fs/promises'
import { existsSync, readdirSync } from 'fs'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { homedir } from 'os'
import { join, relative } from 'path'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { writeFileAtomic } from '../src/main/atomic-write'
import { joinNote, splitNote } from '../src/shared/front-matter'
import { onlyBulletsChanged, standardiseBullets } from '../src/shared/bullet-style'

const apply = process.argv.includes('--apply')
const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const notesRoot = join(home, 'CentralCommand', 'notes')

function* markdownFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    if (entry.name.startsWith('.')) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (path !== join(notesRoot, 'readings')) yield* markdownFiles(path)
    } else if (entry.name.endsWith('.md')) yield path
  }
}

async function run(): Promise<void> {
  console.log(
    apply
      ? 'Mode : APPLY (rewriting notes, with backups)\n'
      : 'Mode : dry run (nothing will be written)\n'
  )
  if (!existsSync(notesRoot)) {
    console.log(`No notes folder (${notesRoot})`)
    return
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(home, 'CentralCommand', 'backups', `standardise-bullets-${stamp}`)
  let changed = 0
  let failed = 0
  let bullets = 0
  for (const path of markdownFiles(notesRoot)) {
    const name = relative(notesRoot, path)
    const note = await readNoteFile(path)
    const { head, body } = splitNote(note.content)
    const result = standardiseBullets(body)
    if (result.changed === 0) continue
    const next = joinNote({ head, body: result.text })
    if (!onlyBulletsChanged(note.content, next) || standardiseBullets(result.text).changed !== 0) {
      failed++
      console.log(`LEFT ALONE ${name}: more than the bullets would change`)
      continue
    }
    console.log(`${name}: ${result.changed} bullet(s)`)
    bullets += result.changed
    if (!apply) {
      changed++
      continue
    }
    const backup = join(backupDir, name)
    await mkdir(join(backup, '..'), { recursive: true })
    await writeFileAtomic(backup, note.content)
    const { result: written, wrote } = await writeNoteFileGuarded(path, next, note.hash)
    if (written.status === 'conflict') {
      failed++
      console.log('  SKIPPED: the file changed while this ran; nothing was written to it.')
    } else if (wrote) changed++
  }
  console.log(
    `\n${bullets} bullet(s) in ${changed} note(s) ${apply ? 'changed' : 'would change'}${failed ? `, ${failed} left alone` : ''}.`
  )
  if (apply && changed > 0) console.log(`Originals are in ${backupDir}`)
  if (!apply) console.log('Dry run only. Re-run with --apply to rewrite these notes.')
}

void run()
