/**
 * One-off importer: copy the free-standing notes of an Obsidian vault (Data Sources, Ideas, Thesis and Placement)
 * into Central Command's Notes folder. Never modifies the vault; never replaces a file.
 *
 *   npm run import:notes -- --vault ~/path/to/vault            # dry run: shows every note and the front matter it would get
 *   npm run import:notes -- --vault ~/path/to/vault --apply    # creates the new note files
 *
 * Every note arrives ungrouped; you group them afterwards. The text is copied exactly as it is (`[[wiki links]]`
 * and `![[images]]` stay as written). The front matter gets a `title` (the file name), a `created` date (when the
 * file was created) and `imported-from` (its place in the vault), each only if the note does not already have one;
 * anything the note already had in its front matter is kept. Each converted note is checked against its source
 * (same text, same TODOs and boxes, same front matter lines); a note that fails is left out and reported.
 *
 * Nothing existing is touched, so there is nothing to back up: files are only created, and never over an existing
 * one (a name that is taken gets ` 2`). Running it twice does not import anything twice: a note whose
 * `imported-from` is already in the folder is skipped.
 *
 * Options: --folders "Data Sources,Ideas,Thesis,Placement" (which vault folders to read), --notes <dir>
 * (default: ~/CentralCommand/notes/notes/research).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { join, resolve } from 'path'
import { createNoteFileExclusive } from '../src/main/notes/guarded-file'
import { splitNote } from '../src/modules/notes/shared/front-matter'
import { isoDate } from '../src/modules/notes/shared/dates'
import {
  IMPORT_FOLDERS,
  importedFromOf,
  planNoteImport,
  type PlanItem,
  type SourceNote
} from '../src/modules/notes/main/import/note-import'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const expand = (p: string): string => resolve(p.replace(/^~(?=$|\/)/, homedir()))

const vaultArg = arg('vault')
if (!vaultArg) {
  console.error('Usage: npm run import:notes -- --vault <path to vault> [--apply]')
  process.exit(1)
}
const vault = expand(vaultArg)
const apply = process.argv.includes('--apply')
const home = process.env.CENTRAL_COMMAND_HOME || homedir()
const dataRoot = join(home, 'CentralCommand')
const notesDir = arg('notes')
  ? expand(arg('notes') as string)
  : join(dataRoot, 'notes', 'notes', 'research')
const folders = arg('folders')
  ? (arg('folders') as string)
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean)
  : [...IMPORT_FOLDERS]

if (!existsSync(vault)) {
  console.error(`Vault not found: ${vault}`)
  process.exit(1)
}

/** Every Markdown file below `dir` (for counting what a deeper folder holds). */
function markdownBelow(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.name.startsWith('.')
      ? []
      : e.isDirectory()
        ? markdownBelow(join(dir, e.name)).map((p) => `${e.name}/${p}`)
        : e.name.endsWith('.md')
          ? [e.name]
          : []
  )
}

const sources: SourceNote[] = []
const deeper: string[] = []
const ignored: string[] = []
const missing: string[] = []
for (const folder of folders) {
  const dir = join(vault, folder)
  if (!existsSync(dir)) {
    missing.push(folder)
    continue
  }
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    if (entry.name.startsWith('.')) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      deeper.push(`${folder}/${entry.name}  (${markdownBelow(path).length} notes)`)
    } else if (entry.name.endsWith('.md')) {
      const stats = statSync(path)
      const born = stats.birthtimeMs > 0 ? stats.birthtimeMs : stats.mtimeMs
      sources.push({
        path: `${folder}/${entry.name}`,
        content: readFileSync(path, 'utf8'),
        created: isoDate(born)
      })
    } else ignored.push(`${folder}/${entry.name}`)
  }
}
const elsewhere = readdirSync(vault, { withFileTypes: true })
  .filter((e) => !e.name.startsWith('.') && !folders.includes(e.name))
  .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
  .sort()

const existingFiles = existsSync(notesDir)
  ? readdirSync(notesDir).filter((f) => f.endsWith('.md') && !f.startsWith('.'))
  : []
const plan = planNoteImport(
  sources,
  existingFiles,
  importedFromOf(
    existingFiles.map((name) => ({ name, content: readFileSync(join(notesDir, name), 'utf8') }))
  )
)

console.log(`Vault        : ${vault}`)
console.log(`Folders      : ${folders.join(', ')}`)
console.log(`Notes folder : ${notesDir} (${existingFiles.length} notes there now)`)
console.log(
  apply
    ? 'Mode         : APPLY (creating files; nothing existing is touched)\n'
    : 'Mode         : dry run (nothing will be written)\n'
)

const indent = (text: string): string =>
  text
    .trimEnd()
    .split('\n')
    .map((l) => `      ${l}`)
    .join('\n')

for (const item of plan) {
  const name = item.source.path
  if (item.status === 'import') {
    const { head, body } = splitNote(item.markdown)
    const lines = body === '' ? 0 : body.split('\n').length - (body.endsWith('\n') ? 1 : 0)
    console.log(`import       ${name}  ->  ${item.target}`)
    console.log(indent(head))
    console.log(
      `      text: ${lines} lines, ${body.length} characters, identical to the vault note (checked)\n`
    )
  } else if (item.status === 'skip-imported') {
    console.log(`skip (done)  ${name}  already imported as ${item.existing}\n`)
  } else {
    console.log(`LEFT OUT     ${name}`)
    for (const p of item.problems) console.log(`      ${p}`)
    console.log('')
  }
}

if (deeper.length) {
  console.log('Deeper folders (not imported; say where these should go):')
  for (const d of deeper) console.log(`  ${d}`)
  console.log('')
}
if (ignored.length) console.log(`Not notes (ignored): ${ignored.join(', ')}\n`)
if (missing.length) console.log(`Folders not found in the vault: ${missing.join(', ')}\n`)
if (elsewhere.length) {
  console.log(`Not read (outside the chosen folders): ${elsewhere.join(', ')}\n`)
}

const toWrite = plan.filter(
  (p): p is Extract<PlanItem, { status: 'import' }> => p.status === 'import'
)
const count = (status: PlanItem['status']): number => plan.filter((p) => p.status === status).length
console.log(
  `${toWrite.length} to import, ${count('skip-imported')} already imported, ${count('failed-check')} left out.`
)

async function writeNotes(): Promise<void> {
  let written = 0
  for (const item of toWrite) {
    // Exclusive: if a file with this name appeared since planning, it is left alone and this note is skipped.
    if (await createNoteFileExclusive(join(notesDir, item.target), item.markdown)) {
      written++
      console.log(`Created ${item.target}`)
    } else console.log(`Skipped ${item.target}: a file with that name appeared since planning.`)
  }
  console.log(`\nCreated ${written} note file(s) in ${notesDir}.`)
  console.log('The app notices new files on its own (or at the next start).')
}

if (!apply) console.log('\nDry run only. Re-run with --apply to create these files.')
else void writeNotes()
