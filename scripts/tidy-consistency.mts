/**
 * Consistency pass over the real library (requested 2 Oct 2026): headings in sentence case, and statistics written
 * the same way everywhere (`*d* = 0.44`, a true minus, always a leading zero). Rules: `src/shared/consistency.ts`.
 *
 *   npm run tidy:consistency                 # dry run: prints every change as a before/after line, writes nothing
 *   npm run tidy:consistency -- --apply      # rewrites them (after copying each to a backup folder)
 *
 * A rewrite that changes the number of lines, or anything but heading and value text, is rejected. Close the app before
 * applying. Proper nouns are learned from the library's own text; extend `EXTRA_PROPER` for any it misses.
 */
import { mkdir } from 'fs/promises'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { homedir } from 'os'
import { join, relative } from 'path'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { writeFileAtomic } from '../src/main/atomic-write'
import { learnProperNouns, normaliseValues, sentenceCaseHeadings } from '../src/shared/consistency'

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

let proper = new Set<string>()

function tidy(
  _rel: string,
  content: string
): { next: string; notes: string[]; left: string[] } | { problem: string } {
  const notes: string[] = []
  let next = sentenceCaseHeadings(content, proper)
  if (next !== content) notes.push('headings')
  const values = normaliseValues(next)
  if (values !== next) notes.push('values')
  next = values
  if (next.split('\n').length !== content.split('\n').length)
    return { problem: 'lines would change' }
  return { next, notes, left: [] }
}

function show(before: string, after: string): void {
  const a = before.split('\n')
  const b = after.split('\n')
  if (a.length === b.length) {
    a.forEach((line, i) => {
      if (line !== b[i])
        console.log(`    - ${line.trim().slice(0, 600)}\n    + ${b[i].trim().slice(0, 600)}`)
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
  const backupDir = join(home, 'CentralCommand', 'backups', `tidy-consistency-${stamp}`)
  let changed = 0
  let problems = 0
  const counts: Record<string, number> = {}
  if (!existsSync(notesRoot)) throw new Error(`No library at ${notesRoot}`)
  const files = markdownFiles(notesRoot).sort()
  const dictionary = new Set(readFileSync('/usr/share/dict/words', 'utf8').split('\n'))
  const isCommonWord = (w: string): boolean =>
    [w, w.replace(/(ed|d|s|es|ing|ly|ion|ions|ness)$/, ''), w.replace(/ied$/, 'y')].some((v) =>
      dictionary.has(v)
    )
  proper = learnProperNouns(
    await Promise.all(files.map(async (f) => (await readNoteFile(f)).content)),
    isCommonWord
  )
  for (const path of files) {
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
    show(note.content, r.next)
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
