/**
 * Citekey markers to reading entities (requested 11 Oct 2026): the Pandoc/Obsidian shorthand `[@Harm2004]` that came in
 * with the imported notes becomes [Harm & Seidenberg (2004)](cc://reading/harmComputingMeaningsWords2004).
 * Rules: `src/shared/citations.ts`. The plain-text pass (`npm run link:citations`) never sees these, as they are not
 * written "Author (Year)".
 *
 *   npm run link:citekeys                 # dry run: prints every proposed link, and what could not be linked
 *   npm run link:citekeys -- --apply      # rewrites the files (after copying each to a backup folder)
 *
 * A marker names only the first author's surname and the year, so it is linked only when exactly one reading fits;
 * ambiguous ones, ones with no reading, and marker-shaped text of a form the rules do not understand are listed and
 * left as they are. The label comes from the reading's own authors, so it reads as the rest of the library does. A
 * rewrite is rejected unless putting every marker back gives the original text byte for byte. Close the app first.
 */
import { mkdir } from 'fs/promises'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { homedir } from 'os'
import { join, relative } from 'path'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { writeFileAtomic } from '../src/main/atomic-write'
import { parseBib } from '../src/modules/readings/main/parse-bib'
import {
  applyCitekeys,
  proposeCitekeys,
  undoCitekeys,
  unreadableCitekeys,
  type CitekeyProposal
} from '../src/shared/citations'

const apply = process.argv.includes('--apply')
const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const notesRoot = join(home, 'CentralCommand', 'notes')
const bibPath = join(home, 'CentralCommand', 'data', 'zotero-export.bib')

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('.')) return []
    const path = join(dir, name)
    return statSync(path).isDirectory() ? markdownFiles(path) : name.endsWith('.md') ? [path] : []
  })
}

const authorName = (a: { family: string } | { literal: string }): string =>
  'family' in a ? a.family : a.literal

/** The marker in its line, with what sits either side of it, so the proposal can be read in context. */
function context(text: string, start: number, length: number): string {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  const lineEnd = text.indexOf('\n', start + length)
  const line = text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd)
  const at = start - lineStart
  const from = Math.max(0, at - 60)
  return (
    (from > 0 ? '…' : '') +
    line.slice(from, at) +
    '⟦' +
    line.slice(at, at + length) +
    '⟧' +
    line.slice(at + length, at + length + 60)
  )
}

async function run(): Promise<void> {
  console.log(
    apply ? 'Mode : APPLY (with backups)\n' : 'Mode : dry run (nothing will be written)\n'
  )
  if (!existsSync(notesRoot)) throw new Error(`No library at ${notesRoot}`)
  const readings = parseBib(readFileSync(bibPath, 'utf8')).map((r) => ({
    citekey: r.citekey,
    authors: r.authors.map(authorName),
    year: r.year
  }))
  console.log(`${readings.length} readings in the Zotero export.\n`)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(home, 'CentralCommand', 'backups', `link-citekeys-${stamp}`)
  const files = markdownFiles(notesRoot).sort()
  let changed = 0
  let links = 0
  let problems = 0
  const ambiguous: string[] = []
  const none: string[] = []
  const unreadable: string[] = []
  for (const path of files) {
    const rel = relative(notesRoot, path)
    const note = await readNoteFile(path)
    const proposals: CitekeyProposal[] = proposeCitekeys(note.content, readings)
    for (const u of unreadableCitekeys(note.content))
      unreadable.push(`${rel}: ${context(note.content, u.start, u.text.length)}`)
    for (const p of proposals) {
      const where = `${rel}: ${context(note.content, p.marker.start, p.marker.text.length)}`
      if (p.resolution.kind === 'ambiguous')
        ambiguous.push(`${where}\n      candidates: ${p.resolution.citekeys.join(', ')}`)
      else if (p.resolution.kind !== 'linked') none.push(where)
    }
    const linked = proposals.filter((p) => p.resolution.kind === 'linked')
    if (linked.length === 0) continue
    console.log(rel)
    for (const p of linked)
      console.log(
        `    ${context(note.content, p.marker.start, p.marker.text.length)}\n` +
          `      -> ${p.label}  [${(p.resolution as { citekey: string }).citekey}]`
      )
    const next = applyCitekeys(note.content, proposals)
    const lines = (s: string): number => s.split('\n').length
    if (undoCitekeys(next, proposals) !== note.content || lines(next) !== lines(note.content)) {
      problems++
      console.log('  LEFT ALONE: putting the markers back does not give the original.')
      continue
    }
    links += linked.length
    if (!apply) {
      changed++
      continue
    }
    await mkdir(join(backupDir, relative(notesRoot, join(path, '..'))), { recursive: true })
    await writeFileAtomic(join(backupDir, rel), note.content)
    const { result, wrote } = await writeNoteFileGuarded(path, next, note.hash)
    if (result.status === 'conflict') {
      problems++
      console.log('  SKIPPED: the file changed while this ran.')
    } else if (wrote) changed++
  }
  console.log(`\n=== AMBIGUOUS (${ambiguous.length}), not linked ===`)
  ambiguous.forEach((l) => console.log(`  ${l}`))
  console.log(`\n=== NO READING IN ZOTERO (${none.length}), not linked ===`)
  none.forEach((l) => console.log(`  ${l}`))
  console.log(`\n=== NOT UNDERSTOOD (${unreadable.length}), not linked ===`)
  unreadable.forEach((l) => console.log(`  ${l}`))
  console.log(
    `\n${links} link(s) in ${changed} file(s) ${apply ? 'written' : 'proposed'}, ${problems} left alone.`
  )
  if (apply && changed > 0) console.log(`Originals are in ${backupDir}`)
  if (!apply) console.log('Dry run only. Re-run with --apply to rewrite these files.')
}

void run()
