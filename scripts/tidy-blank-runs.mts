/**
 * One-off tidy (17 Oct 2026, `docs/EXTRA_BLANK_LINES_PLAN.md`, stage 2): cut every run of blank lines to one, in every
 * note folder including `readings/`. From now on the editor draws each blank line after the first as visible space, so
 * the notes are brought to "no more than one" first.
 *
 *   npm run tidy:blank-runs                # dry run: lists the notes it would change, writes nothing
 *   npm run tidy:blank-runs -- --apply     # rewrites them (after copying each to a backup folder)
 *
 * Only blank lines go (empty or whitespace only); blank lines inside code fences and the front matter stay. Each result
 * is checked (every non-blank line identical, in order) and a note that fails is left alone and reported. Readings notes
 * are included: this removes only blank lines, backs each file up first and writes through the content-hash guard, the
 * same as a save in the app. Applying copies every note it changes to `~/CentralCommand/backups/tidy-blank-runs-<time>/`
 * first; a note that changed since it was read is skipped. Close the app before applying. A second run finds nothing.
 */
import { mkdir } from 'fs/promises'
import { existsSync, readdirSync, statSync } from 'fs'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { homedir } from 'os'
import { dirname, join, relative } from 'path'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { writeFileAtomic } from '../src/main/atomic-write'
import { splitNote } from '../src/shared/front-matter'
import { collapseBlankRuns } from '../src/shared/heading-spacing'

const apply = process.argv.includes('--apply')
const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const notesRoot = join(home, 'CentralCommand', 'notes')

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('.')) return []
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return markdownFiles(path)
    return name.endsWith('.md') ? [path] : []
  })
}

const content = (t: string): string[] => t.split('\n').filter((l) => l.trim() !== '')

/** The front matter with the blank lines after it cut to one (`splitNote` keeps them in the head, not the body). */
function collapseHead(head: string): string {
  const m = /^([\s\S]*?\n)((?:[ \t]*\r?\n)*)$/.exec(head)
  if (!m || m[2] === '') return head
  return m[1] + /^[ \t]*\r?\n/.exec(m[2])![0]
}
const lineCount = (t: string): number => t.split('\n').length

async function run(): Promise<void> {
  console.log(
    apply
      ? 'Mode : APPLY (rewriting notes, with backups)\n'
      : 'Mode : dry run (nothing will be written)\n'
  )
  if (!existsSync(notesRoot)) throw new Error(`No library at ${notesRoot}`)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(home, 'CentralCommand', 'backups', `tidy-blank-runs-${stamp}`)
  let seen = 0
  let changed = 0
  let failed = 0
  let removedTotal = 0
  const byFolder = new Map<string, number>()
  for (const path of markdownFiles(notesRoot).sort()) {
    const rel = relative(notesRoot, path)
    const note = await readNoteFile(path)
    const { head, body } = splitNote(note.content)
    seen++
    const tidyHead = collapseHead(head)
    const tidy = collapseBlankRuns(body)
    if (tidy === body && tidyHead === head) continue
    if (content(tidyHead + tidy).join('\n') !== content(head + body).join('\n')) {
      failed++
      console.log(`LEFT ALONE ${rel}: text other than blank lines would change`)
      continue
    }
    const removed = lineCount(head + body) - lineCount(tidyHead + tidy)
    removedTotal += removed
    const folder = dirname(rel)
    byFolder.set(folder, (byFolder.get(folder) ?? 0) + 1)
    console.log(`${rel}: ${removed} blank line(s) removed`)
    if (!apply) {
      changed++
      continue
    }
    await mkdir(join(backupDir, dirname(rel)), { recursive: true })
    await writeFileAtomic(join(backupDir, rel), note.content)
    const { result, wrote } = await writeNoteFileGuarded(path, tidyHead + tidy, note.hash)
    if (result.status === 'conflict') {
      failed++
      console.log('  SKIPPED: the file changed while this ran; nothing was written to it.')
    } else if (wrote) changed++
  }
  console.log(
    `\n${changed} of ${seen} note(s) ${apply ? 'changed' : 'would change'}, ${removedTotal} blank line(s)${failed ? `, ${failed} left alone` : ''}.`
  )
  if (byFolder.size > 0) {
    console.log('\nBy folder:')
    for (const [folder, n] of [...byFolder].sort()) console.log(`  ${folder}: ${n}`)
  }
  if (apply && changed > 0) console.log(`Originals are in ${backupDir}`)
  if (!apply) console.log('Dry run only. Re-run with --apply to rewrite these notes.')
}

void run()
