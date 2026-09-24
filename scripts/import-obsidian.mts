/**
 * One-off importer: copy reading notes from an Obsidian vault (made with the Citation plugin)
 * into Central Command's notes folder. Never modifies the vault; never overwrites a note.
 *
 *   npm run import:obsidian -- --vault ~/path/to/vault            # dry run: shows the plan
 *   npm run import:obsidian -- --vault ~/path/to/vault --apply    # writes the new note files
 *
 * Options: --folder <name> (default "Readings"), --export <file.bib>, --notes <dir>
 */
import { existsSync, readFileSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join, resolve } from 'path'
import { writeFileAtomic } from '../src/main/atomic-write'
import {
  parseObsidianNote,
  planImport,
  type ImportItem
} from '../src/modules/readings/main/obsidian-import'
import { parseBib } from '../src/modules/readings/main/parse-bib'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const expand = (p: string): string => resolve(p.replace(/^~(?=$|\/)/, homedir()))

const vault = arg('vault')
if (!vault) {
  console.error('Usage: npm run import:obsidian -- --vault <path to vault> [--apply]')
  process.exit(1)
}
const apply = process.argv.includes('--apply')
const home = process.env.CENTRAL_COMMAND_HOME || homedir()
const dataRoot = join(home, 'CentralCommand')

let exportPath = join(dataRoot, 'data', 'zotero-export.bib')
try {
  const saved = JSON.parse(readFileSync(join(dataRoot, 'settings.json'), 'utf8')).zoteroExportPath
  if (typeof saved === 'string' && saved) exportPath = saved
} catch {
  // No settings yet: use the default location.
}
exportPath = arg('export') ? expand(arg('export') as string) : exportPath
const notesDir = arg('notes') ? expand(arg('notes') as string) : join(dataRoot, 'notes', 'readings')
const folder = join(expand(vault), arg('folder') ?? 'Readings')

if (!existsSync(folder)) {
  console.error(`Vault folder not found: ${folder}`)
  process.exit(1)
}
if (!existsSync(exportPath)) {
  console.error(`Zotero export not found: ${exportPath} (set it up first, or pass --export)`)
  process.exit(1)
}

const readings = parseBib(readFileSync(exportPath, 'utf8'))
const files = readdirSync(folder).filter((f) => f.endsWith('.md'))
const literature = files.filter((f) => f.startsWith('@'))
const others = files.filter((f) => !f.startsWith('@'))
const existing = new Set(existsSync(notesDir) ? readdirSync(notesDir) : [])
const notes = literature.map((f) => parseObsidianNote(f, readFileSync(join(folder, f), 'utf8')))
const plan = planImport(notes, readings, existing)

const describe = (item: ImportItem): string => {
  switch (item.status) {
    case 'import':
      return `import       ${item.note.fileName.padEnd(26)} -> ${item.target}${item.kind === 'title-prefix' ? '   (matched on the start of the title)' : ''}`
    case 'skip-empty':
      return `skip (empty) ${item.note.fileName.padEnd(26)}    only the empty template, nothing to keep`
    case 'skip-exists':
      return `skip (exists) ${item.note.fileName.padEnd(25)}    ${item.target} already has notes; left untouched`
    case 'skip-duplicate':
      return `skip (dup)   ${item.note.fileName.padEnd(26)}    same reading as ${item.firstNote}`
    case 'ambiguous':
      return `AMBIGUOUS    ${item.note.fileName.padEnd(26)}    could be: ${item.candidates.map((c) => c.citekey).join(', ')}`
    case 'unmatched':
      return `NO MATCH     ${item.note.fileName.padEnd(26)}    "${item.note.title}" (${item.note.year ?? '?'}) is not in the Zotero export`
  }
}

console.log(`Vault folder : ${folder}`)
console.log(`Zotero export: ${exportPath} (${readings.length} readings)`)
console.log(`Notes folder : ${notesDir}`)
console.log(
  apply
    ? 'Mode         : APPLY (writing files)\n'
    : 'Mode         : dry run (nothing will be written)\n'
)
for (const item of plan) console.log(describe(item))
if (others.length) console.log(`\nIgnored (not literature notes): ${others.join(', ')}`)

const toWrite = plan.filter(
  (p): p is Extract<ImportItem, { status: 'import' }> => p.status === 'import'
)
const count = (status: ImportItem['status']): number =>
  plan.filter((p) => p.status === status).length
console.log(
  `\n${toWrite.length} to import, ${count('skip-empty')} empty, ${count('skip-exists')} already there, ` +
    `${count('unmatched') + count('ambiguous')} need attention.`
)

async function writeNotes(): Promise<void> {
  for (const item of toWrite) {
    const target = join(notesDir, item.target)
    if (existsSync(target)) {
      console.log(`Skipped ${item.target}: it appeared since planning.`)
      continue
    }
    await writeFileAtomic(target, item.markdown)
  }
  console.log(`\nWrote ${toWrite.length} note file(s) to ${notesDir}.`)
  console.log('Open the app (or restart it) and the notes icons and search will pick them up.')
}

if (!apply) {
  console.log('\nDry run only. Re-run with --apply to write these files.')
} else {
  void writeNotes()
}
