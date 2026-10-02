/**
 * One-off clean-up of the real library (requested 2 Oct 2026):
 *   - remove empty `## Notes` headings from Training entries,
 *   - repair the escaped links in the Training plan,
 *   - convert LaTeX spans (`$\rightarrow$`, `$d = .44$`) to Unicode and APA-style statistics, in every note.
 *
 *   npm run tidy:library                 # dry run: prints every change as a before/after line, writes nothing
 *   npm run tidy:library -- --apply      # rewrites them (after copying each to a backup folder)
 *
 * Each rewrite is checked (a transform that changes the number of non-blank lines other than by removing the empty
 * heading is rejected) and written with the app's content-hash guard. Close the app before applying.
 */
import { mkdir } from 'fs/promises'
import { existsSync, readdirSync, statSync } from 'fs'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { homedir } from 'os'
import { join, relative } from 'path'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { writeFileAtomic } from '../src/main/atomic-write'
import { convertMath, fixEscapedLinks, removeEmptyNotes } from '../src/shared/library-tidy'

const apply = process.argv.includes('--apply')
const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const notesRoot = join(home, 'CentralCommand', 'notes')

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('.')) return []
    const path = join(dir, name)
    return statSync(path).isDirectory() ? markdownFiles(path) : name.endsWith('.md') ? [path] : []
  })
}

const nonBlank = (t: string): number => t.split('\n').filter((l) => l.trim()).length

function tidy(
  rel: string,
  content: string
): { next: string; notes: string[]; left: string[] } | { problem: string } {
  const notes: string[] = []
  let next = content
  if (rel.startsWith('training/')) {
    const t = removeEmptyNotes(next)
    if (t !== next) notes.push('empty Notes heading removed')
    if (nonBlank(next) - nonBlank(t) > 1) return { problem: 'more than the heading would go' }
    next = t
  }
  if (rel.startsWith('training-plans/')) {
    const t = fixEscapedLinks(next)
    if (t !== next) notes.push('links repaired')
    if (nonBlank(t) !== nonBlank(next)) return { problem: 'lines would be lost' }
    next = t
  }
  const math = convertMath(next)
  if (math.text !== next) notes.push('LaTeX converted')
  if (nonBlank(math.text) !== nonBlank(next)) return { problem: 'lines would be lost' }
  next = math.text
  return { next, notes, left: math.left }
}

function show(before: string, after: string): void {
  const a = before.split('\n')
  const b = after.split('\n')
  if (a.length === b.length) {
    a.forEach((line, i) => {
      if (line !== b[i])
        console.log(`    - ${line.trim().slice(0, 200)}\n    + ${b[i].trim().slice(0, 200)}`)
    })
  } else
    console.log(
      `    - ${a
        .slice(b.length - 1)
        .join(' / ')
        .trim()
        .slice(0, 100)} (removed)`
    )
}

async function run(): Promise<void> {
  console.log(
    apply ? 'Mode : APPLY (with backups)\n' : 'Mode : dry run (nothing will be written)\n'
  )
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(home, 'CentralCommand', 'backups', `tidy-library-${stamp}`)
  let changed = 0
  let problems = 0
  const counts: Record<string, number> = {}
  if (!existsSync(notesRoot)) throw new Error(`No library at ${notesRoot}`)
  for (const path of markdownFiles(notesRoot).sort()) {
    const rel = relative(notesRoot, path)
    const note = await readNoteFile(path)
    const r = tidy(rel, note.content)
    if ('problem' in r) {
      problems++
      console.log(`LEFT ALONE ${rel}: ${r.problem}`)
      continue
    }
    for (const l of r.left) console.log(`UNKNOWN LaTeX in ${rel}: ${l}`)
    if (r.next === note.content) continue
    console.log(`${rel}: ${r.notes.join(', ')}`)
    if (!rel.startsWith('training/')) show(note.content, r.next)
    for (const n of r.notes) counts[n] = (counts[n] ?? 0) + 1
    if (!apply) {
      changed++
      continue
    }
    await mkdir(join(backupDir, relative(notesRoot, join(path, '..'))), { recursive: true })
    await writeFileAtomic(join(backupDir, rel), note.content)
    const { result, wrote } = await writeNoteFileGuarded(path, r.next, note.hash)
    if (result.status === 'conflict') {
      problems++
      console.log('  SKIPPED: the file changed while this ran.')
    } else if (wrote) changed++
  }
  console.log(`\n${changed} file(s) ${apply ? 'changed' : 'would change'}, ${problems} left alone.`)
  console.log(counts)
  if (apply && changed > 0) console.log(`Originals are in ${backupDir}`)
  if (!apply) console.log('Dry run only. Re-run with --apply to rewrite these files.')
}

void run()
