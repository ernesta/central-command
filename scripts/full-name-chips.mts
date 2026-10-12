/**
 * One-off clean-up: write every person chip's label as the person's full name, in every note.
 *
 *   npm run fullname:chips                 # dry run: lists the notes it would change, writes nothing
 *   npm run fullname:chips -- --apply      # rewrites them (after copying each to a backup folder)
 *
 * `[Kathy](cc://person/Kathy%20Rastle)` becomes `[Kathy Rastle](cc://person/Kathy%20Rastle)`: the words of the prose
 * change, the address does not. The front matter is never touched, the Readings notes (`notes/readings/`) are skipped, and
 * each result is checked (same chips pointing at the same people, only labels different) before it is written; a note that
 * fails is left alone and reported. Applying copies every note it changes to `~/CentralCommand/backups/fullname-chips-<time>/`
 * first and writes with the app's content-hash guard. Close the app before applying.
 */
import { mkdir } from 'fs/promises'
import { existsSync, readdirSync } from 'fs'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { homedir } from 'os'
import { join, relative } from 'path'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { writeFileAtomic } from '../src/main/atomic-write'
import { joinNote, splitNote } from '../src/shared/front-matter'
import { findPersonChips, fullNamePersonChips } from '../src/shared/people-mentions'

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

const sameChips = (a: string, b: string): boolean => {
  const x = findPersonChips(a)
  const y = findPersonChips(b)
  return x.length === y.length && x.every((c, i) => c.name === y[i].name)
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
  const backupDir = join(home, 'CentralCommand', 'backups', `fullname-chips-${stamp}`)
  let changed = 0
  let failed = 0
  let chips = 0
  for (const path of markdownFiles(notesRoot)) {
    const name = relative(notesRoot, path)
    const note = await readNoteFile(path)
    const { head, body } = splitNote(note.content)
    const result = fullNamePersonChips(body)
    if (result.changed === 0) continue
    const next = joinNote({ head, body: result.text })
    if (
      !sameChips(body, result.text) ||
      fullNamePersonChips(result.text).changed !== 0 ||
      splitNote(next).head !== head
    ) {
      failed++
      console.log(`LEFT ALONE ${name}: more than the labels would change`)
      continue
    }
    const was = findPersonChips(body)
      .filter((c) => c.label !== c.name)
      .map((c) => `${c.label} -> ${c.name}`)
    console.log(`${name}: ${result.changed} chip(s): ${[...new Set(was)].join('; ')}`)
    chips += result.changed
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
    `\n${chips} chip(s) in ${changed} note(s) ${apply ? 'changed' : 'would change'}${failed ? `, ${failed} left alone` : ''}.`
  )
  if (apply && changed > 0) console.log(`Originals are in ${backupDir}`)
  if (!apply) console.log('Dry run only. Re-run with --apply to rewrite these notes.')
}

void run()
