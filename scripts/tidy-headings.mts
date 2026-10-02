/**
 * One-off tidy (requested 2 Oct 2026): take out the blank lines next to headings in every note, since the editor now
 * draws the space around headings itself and new notes are made without them.
 *
 *   npm run tidy:headings                # dry run: lists the notes it would change, writes nothing
 *   npm run tidy:headings -- --apply     # rewrites them (after copying each to a backup folder)
 *
 * Only blank lines that touch a heading go; blank lines between paragraphs, lists and tables, code fences and the
 * front matter stay as they are. Each result is checked (every non-blank line identical, in order) and a note that
 * fails is left alone and reported. Reading notes (`readings/`) are not touched. Applying copies every note it changes
 * to `~/CentralCommand/backups/tidy-headings-<time>/` first and writes with the app's content-hash guard: a note that
 * changed since it was read is skipped. Close the app before applying.
 */
import { mkdir } from 'fs/promises'
import { existsSync, readdirSync, statSync } from 'fs'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { homedir } from 'os'
import { join, relative } from 'path'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { writeFileAtomic } from '../src/main/atomic-write'
import { splitNote } from '../src/shared/front-matter'
import { tightenHeadings } from '../src/shared/heading-spacing'

const apply = process.argv.includes('--apply')
const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const notesRoot = join(home, 'CentralCommand', 'notes')

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('.')) return []
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'readings' ? [] : markdownFiles(path)
    return name.endsWith('.md') ? [path] : []
  })
}

const content = (t: string): string[] => t.split('\n').filter((l) => l.trim() !== '')

async function run(): Promise<void> {
  console.log(
    apply
      ? 'Mode : APPLY (rewriting notes, with backups)\n'
      : 'Mode : dry run (nothing will be written)\n'
  )
  if (!existsSync(notesRoot)) throw new Error(`No library at ${notesRoot}`)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(home, 'CentralCommand', 'backups', `tidy-headings-${stamp}`)
  let changed = 0
  let failed = 0
  let blanks = 0
  for (const path of markdownFiles(notesRoot).sort()) {
    const rel = relative(notesRoot, path)
    const note = await readNoteFile(path)
    const { head, body } = splitNote(note.content)
    const tight = tightenHeadings(body)
    if (tight === body) continue
    if (content(tight).join('\n') !== content(body).join('\n')) {
      failed++
      console.log(`LEFT ALONE ${rel}: text other than blank lines would change`)
      continue
    }
    const removed = body.split('\n').length - tight.split('\n').length
    blanks += removed
    console.log(`${rel}: ${removed} blank line(s) removed`)
    if (!apply) {
      changed++
      continue
    }
    await mkdir(join(backupDir, relative(notesRoot, join(path, '..'))), { recursive: true })
    await writeFileAtomic(join(backupDir, rel), note.content)
    const { result, wrote } = await writeNoteFileGuarded(path, head + tight, note.hash)
    if (result.status === 'conflict') {
      failed++
      console.log('  SKIPPED: the file changed while this ran; nothing was written to it.')
    } else if (wrote) changed++
  }
  console.log(
    `\n${changed} note(s) ${apply ? 'changed' : 'would change'}, ${blanks} blank line(s)${failed ? `, ${failed} left alone` : ''}.`
  )
  if (apply && changed > 0) console.log(`Originals are in ${backupDir}`)
  if (!apply) console.log('Dry run only. Re-run with --apply to rewrite these notes.')
}

void run()
