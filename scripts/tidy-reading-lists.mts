/**
 * Reading lists to entities (notes feedback round, stage 4, requested 2 Oct 2026). Rules: `list-tidy.ts` in
 * `src/modules/reading-lists/shared/`.
 *
 *   npm run tidy:reading-lists             # dry run: prints every change and the entries still waiting for a reading
 *   npm run tidy:reading-lists -- --apply  # rewrites the lists (after copying each to a backup folder)
 *
 * A linked entry is shortened to its link (the reading holds the title and journal); `**@key**` becomes a link; a
 * typed citation is linked only when exactly one reading in the Zotero export fits it, otherwise kept as written. Re-run
 * it after adding readings to Zotero. A rewrite is rejected unless every annotation is unchanged. Close the app first.
 */
import { mkdir } from 'fs/promises'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { homedir } from 'os'
import { join } from 'path'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { writeFileAtomic } from '../src/main/atomic-write'
import { parseBib } from '../src/modules/readings/main/parse-bib'
import { splitNote } from '../src/modules/reading-lists/shared/front-matter'
import { parseListBody } from '../src/modules/reading-lists/shared/list-body'
import { tidyListBody } from '../src/modules/reading-lists/shared/list-tidy'

const apply = process.argv.includes('--apply')
const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const root = join(home, 'CentralCommand')
const listsRoot = join(root, 'notes', 'reading-lists')
const authorName = (a: { family: string } | { literal: string }): string =>
  'family' in a ? a.family : a.literal

function shortLabel(authors: string[], year: number | null): string {
  const names =
    authors.length >= 3
      ? `${authors[0]} et al.`
      : authors.length === 2
        ? `${authors[0]} & ${authors[1]}`
        : (authors[0] ?? '')
  return year ? `${names} (${year})` : names
}

async function run(): Promise<void> {
  console.log(
    apply ? 'Mode : APPLY (with backups)\n' : 'Mode : dry run (nothing will be written)\n'
  )
  if (!existsSync(listsRoot)) throw new Error(`No reading lists at ${listsRoot}`)
  const readings = parseBib(readFileSync(join(root, 'data', 'zotero-export.bib'), 'utf8')).map(
    (r) => ({ citekey: r.citekey, authors: r.authors.map(authorName), year: r.year })
  )
  const labels = new Map(readings.map((r) => [r.citekey, shortLabel(r.authors, r.year)]))
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(root, 'backups', `tidy-reading-lists-${stamp}`)
  let changed = 0
  let problems = 0
  for (const workspace of readdirSync(listsRoot).filter((n) => !n.startsWith('.'))) {
    const dir = join(listsRoot, workspace)
    if (!existsSync(dir) || !readdirSync(dir)) continue
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
      const path = join(dir, name)
      const note = await readNoteFile(path)
      const { head, body } = splitNote(note.content)
      const result = tidyListBody(body, { readings, labelFor: (k) => labels.get(k) ?? '' })
      console.log(`${workspace}/${name}: ${result.changes.length} change(s)`)
      result.changes.forEach((c) => console.log(`    ${c}`))
      if (result.waiting.length)
        console.log(`  still waiting for a reading (${result.waiting.length}):`)
      result.waiting.forEach((w) => console.log(`    ${w.slice(0, 110)}`))
      if (result.changes.length === 0) continue
      const next = note.content.slice(0, note.content.length - body.length) + result.body
      const before = parseListBody(body).flatMap((s) => s.entries.map((e) => e.annotation))
      const after = parseListBody(result.body).flatMap((s) => s.entries.map((e) => e.annotation))
      if (
        head !== next.slice(0, head.length) ||
        JSON.stringify(before) !== JSON.stringify(after) ||
        body.split('\n').length !== result.body.split('\n').length
      ) {
        problems++
        console.log('  LEFT ALONE: annotations or line count would change.')
        continue
      }
      if (!apply) {
        changed++
        continue
      }
      await mkdir(join(backupDir, workspace), { recursive: true })
      await writeFileAtomic(join(backupDir, workspace, name), note.content)
      const { result: saved, wrote } = await writeNoteFileGuarded(path, next, note.hash)
      if (saved.status === 'conflict') {
        problems++
        console.log('  SKIPPED: the file changed while this ran.')
      } else if (wrote) changed++
    }
  }
  console.log(`\n${changed} list(s) ${apply ? 'written' : 'to change'}, ${problems} left alone.`)
  if (apply && changed > 0) console.log(`Originals are in ${backupDir}`)
  if (!apply) console.log('Dry run only. Re-run with --apply to rewrite these lists.')
}

void run()
