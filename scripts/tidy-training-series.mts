/**
 * One-off tidy-up of training series and titles (agreed 30 Sep 2026): a series is the full programme or module name,
 * and the title is only the session ("Research Training Seminar: Peer Review" becomes series "Research Training
 * Seminar", title "Peer Review"). A module with no session titles (PS5302, PS2021) becomes the series and keeps its title.
 *
 *   npm run tidy:series                 # dry run: lists every change, writes nothing
 *   npm run tidy:series -- --apply      # rewrites the entries (after copying each to a backup folder)
 *
 * Only the `series` and `title` lines change; each result is checked (text and every other field identical) before it
 * is written. A file is then renamed to match its date and title, as the app does, and never replaces another file.
 * Applying copies every entry it changes to `~/CentralCommand/backups/tidy-training-series-<time>/` first and writes
 * with the app's content-hash guard. Close the app before applying.
 */
import { mkdir } from 'fs/promises'
import { existsSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import {
  readNoteFile,
  renameNoteFileExclusive,
  writeNoteFileGuarded
} from '../src/main/notes/guarded-file'
import { writeFileAtomic } from '../src/main/atomic-write'
import { trainingBaseName } from '../src/modules/training/main/file-name'
import {
  parseTrainingMeta,
  splitNote,
  updateTrainingHead
} from '../src/modules/training/shared/front-matter'

const apply = process.argv.includes('--apply')
const home = process.env.CENTRAL_COMMAND_HOME || homedir()
const dataRoot = join(home, 'CentralCommand')
const dir = join(dataRoot, 'notes', 'training', 'research')

/** Title prefix (before `: `) → series. */
const PREFIXES: Record<string, string> = {
  'Research Training Seminar': 'Research Training Seminar',
  'Psychology Seminar Series': 'Psychology Seminar Series',
  'Researcher Development Programme': 'Researcher Development Programme',
  'SENSS Experimental Methods in the Social Sciences':
    'SENSS Experimental Methods in the Social Sciences',
  'SENSS Specialist Training': 'SENSS Specialist Training',
  'LSE DTP Training': 'LSE DTP Training',
  'LSE DTP': 'LSE DTP Training',
  'PS5210 Applied Neuroscience Methods': 'PS5210 Applied Neuroscience Methods'
}
/** Whole title → series; the title stays. */
const MODULES = new Set(['PS5302 Statistics for Research', 'PS2021 Cognitive Psychology'])

function plan(title: string): { series: string; title: string } | null {
  if (MODULES.has(title)) return { series: title, title }
  for (const [prefix, series] of Object.entries(PREFIXES)) {
    if (title.startsWith(`${prefix}: `)) return { series, title: title.slice(prefix.length + 2) }
  }
  if (title.startsWith('SEDarc Induction'))
    return { series: 'SEDarc', title: title.slice('SEDarc '.length) }
  return null
}

async function run(): Promise<void> {
  console.log(
    apply ? 'Mode : APPLY (with backups)\n' : 'Mode : dry run (nothing will be written)\n'
  )
  if (!existsSync(dir)) return void console.log(`No folder: ${dir}`)
  const backupDir = join(
    dataRoot,
    'backups',
    `tidy-training-series-${new Date().toISOString().replace(/[:.]/g, '-')}`
  )
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
    .sort()
  const taken = new Set(files.map((f) => f.replace(/\.md$/, '')))
  let changed = 0
  let failed = 0
  for (const file of files) {
    const path = join(dir, file)
    const note = await readNoteFile(path)
    const { head, body } = splitNote(note.content)
    const { meta } = parseTrainingMeta(head)
    const change = plan(meta.title ?? '')
    if (!change || (change.series === meta.series && change.title === meta.title)) continue
    const next = splitNote(note.content)
    const newHead = updateTrainingHead(head, { series: change.series, title: change.title })
    const after = parseTrainingMeta(newHead).meta
    const same =
      JSON.stringify({ ...after, series: 0, title: 0 }) ===
      JSON.stringify({ ...meta, series: 0, title: 0 })
    const content = newHead + body
    if (
      !same ||
      splitNote(content).body !== next.body ||
      after.series !== change.series ||
      after.title !== change.title
    ) {
      failed++
      console.log(`LEFT ALONE ${file}: another field or the text would change`)
      continue
    }
    const id = file.replace(/\.md$/, '')
    taken.delete(id)
    const newId = trainingBaseName(meta.date ?? '', change.title, taken)
    taken.add(newId)
    console.log(
      `${meta.date}  [${meta.series ?? 'none'} → ${change.series}]  "${meta.title}" → "${change.title}"${newId !== id ? `\n    file: ${id}.md → ${newId}.md` : ''}`
    )
    if (!apply) {
      changed++
      continue
    }
    await mkdir(backupDir, { recursive: true })
    await writeFileAtomic(join(backupDir, file), note.content)
    const { result, wrote } = await writeNoteFileGuarded(path, content, note.hash)
    if (result.status === 'conflict') {
      failed++
      console.log('  SKIPPED: the file changed while this ran.')
      continue
    }
    if (wrote) changed++
    if (newId !== id && !(await renameNoteFileExclusive(path, join(dir, `${newId}.md`)))) {
      console.log('  Written, but not renamed (the new name is taken).')
    }
  }
  console.log(
    `\n${changed} entr${changed === 1 ? 'y' : 'ies'} ${apply ? 'changed' : 'would change'}${failed ? `, ${failed} left alone` : ''}.`
  )
  if (apply && changed > 0) console.log(`Originals are in ${backupDir}`)
  if (!apply) console.log('Dry run only. Re-run with --apply to rewrite these entries.')
}

void run()
