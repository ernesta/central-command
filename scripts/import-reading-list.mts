/**
 * One-off importer: turn a curated reading list written as a Word document into one of Central Command's
 * reading lists. The shape this expects (`docs/DECISIONS.md`, "Reading lists"): a bold paragraph is a
 * section heading, written as a question; the bullet list under it holds one entry per paper, each
 * "Author (Year). Title. Journal, volume(issue), pages. – a one- or two-sentence annotation". The Word
 * file is read with macOS `textutil` (the same tool the meetings importer uses), converted to HTML so the
 * bold runs and list structure survive.
 *
 *   npm run import:reading-list -- --file <path to .docx>            # dry run: shows the list it would create
 *   npm run import:reading-list -- --file <path to .docx> --apply    # creates the list file
 *
 * Every entry becomes a placeholder citation (bold plain text, not linked to a reading): attach each one
 * by hand from the list's own page ("Attach a reading…"), the same way every importer in this app leaves
 * a matching decision to you rather than guessing it. Each entry is checked against the source before
 * anything is written (`planListImport`'s own safety check); if any entry does not round-trip, nothing is
 * written and the mismatch is printed instead.
 *
 * Options: --title "…" (default: the file name, with a leading date and the extension stripped),
 * --list-dir <folder> (default: ~/CentralCommand/notes/reading-lists/research).
 */
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, readdirSync } from 'fs'
import { homedir, platform } from 'os'
import { basename, join, resolve } from 'path'
import { createNoteFileExclusive } from '../src/main/notes/guarded-file'
import { idFromFileName, listBaseName, listPath } from '../src/modules/reading-lists/main/file-name'
import { planListImport } from '../src/modules/reading-lists/main/import/list-import'
import { updateHead } from '../src/modules/reading-lists/shared/front-matter'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const expand = (p: string): string => resolve(p.replace(/^~(?=$|\/)/, homedir()))

if (platform() !== 'darwin')
  fail('This importer reads Word files with macOS `textutil`, so it only runs on a Mac.')

const fileArg = arg('file')
if (!fileArg) {
  fail('Usage: npm run import:reading-list -- --file <path to .docx> [--title "…"] [--apply]')
}
const file = expand(fileArg)
if (!existsSync(file)) fail(`No such file: ${file}`)

const apply = process.argv.includes('--apply')
const home = process.env.CENTRAL_COMMAND_HOME || homedir()
const listDir = arg('list-dir')
  ? expand(arg('list-dir') as string)
  : join(home, 'CentralCommand', 'notes', 'reading-lists', 'research')

const defaultTitle = basename(file)
  .replace(/\.docx?$/i, '')
  .replace(/^\d{4}[ -]?\d{2}[ -]?\d{2}\s+/, '')
const title = arg('title') ?? defaultTitle

const html = execFileSync('textutil', ['-convert', 'html', '-stdout', file], { encoding: 'utf8' })

let plan: ReturnType<typeof planListImport>
try {
  plan = planListImport(html)
} catch (error) {
  fail(String(error))
}

console.log(`Source   : ${file}`)
console.log(`Title    : ${title}`)
console.log(`Sections : ${plan.sectionCount}`)
console.log(`Entries  : ${plan.entryCount}`)
for (const section of plan.sections) {
  console.log(`  ${section.heading} (${section.entries.length})`)
}
if (plan.problems.length > 0) {
  console.log(`\n${plan.problems.length} thing(s) worth a look:`)
  for (const problem of plan.problems) console.log(`  - ${problem}`)
}

if (apply) {
  mkdirSync(listDir, { recursive: true })
  const taken = (existsSync(listDir) ? readdirSync(listDir) : [])
    .map(idFromFileName)
    .filter((id): id is string => id !== null)
  const id = listBaseName(title, taken)
  const head = updateHead('', { title })
  const wrote = await createNoteFileExclusive(listPath(listDir, id), head + plan.body)
  console.log(
    wrote ? `\nWrote "${id}.md" to ${listDir}` : `\nCould not write "${id}.md" (already exists?)`
  )
} else {
  console.log('\nDry run only. Re-run with --apply to write this file.')
}
