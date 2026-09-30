/**
 * One-off importer: bring Work meeting notes from an Obsidian vault into Central Command.
 *
 *   npm run import:work-meetings -- --vault ~/path/to/vault                # dry run
 *   npm run import:work-meetings -- --vault ~/path/to/vault --apply        # writes files
 *
 * Source (read only, never modified): a "Meetings" folder in the vault, one sub-folder per series (e.g.
 * "Impact", "Teaching & Learning"). Unlike the Research importer, there is no Word log or Word notes to
 * merge in, so start, end and a summary are always left empty; the series is the sub-folder's own name,
 * not a tag or a name pattern. See `docs/DECISIONS.md`, "Work meetings import".
 *
 * Never overwrites an existing meeting; running it again after an import writes nothing.
 */
import { existsSync, readFileSync, readdirSync } from 'fs'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { homedir } from 'os'
import { join, resolve } from 'path'
import { createNoteFileExclusive } from '../src/main/notes/guarded-file'
import {
  planWorkMeetingImport,
  type ExistingWorkMeeting,
  type WorkPlanItem
} from '../src/modules/meetings/main/import/work-meeting-import'
import { formatDate } from '../src/modules/meetings/shared/time'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const expand = (p: string): string => resolve(p.replace(/^~(?=$|\/)/, homedir()))
const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}

const vaultArg = arg('vault')
if (!vaultArg) {
  fail('Usage: npm run import:work-meetings -- --vault <path to the Meetings folder> [--apply]')
}
const apply = process.argv.includes('--apply')
const folder = expand(vaultArg as string)
const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const dataRoot = join(home, 'CentralCommand')
const meetingsDir = arg('meetings')
  ? expand(arg('meetings') as string)
  : join(dataRoot, 'notes', 'meetings', 'work')

if (!existsSync(folder)) fail(`Meetings folder not found: ${folder}`)

// --- read the vault: one sub-folder per series, a flat file directly in it is not expected but is read
// with an empty series (and so reported as needing attention, same as an unreadable date).
const obsidian = readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
  if (entry.name.startsWith('.')) return []
  if (entry.isFile() && entry.name.endsWith('.md')) {
    return [
      { fileName: entry.name, folder: '', text: readFileSync(join(folder, entry.name), 'utf8') }
    ]
  }
  if (entry.isDirectory()) {
    return readdirSync(join(folder, entry.name))
      .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
      .map((f) => ({
        fileName: f,
        folder: entry.name,
        text: readFileSync(join(folder, entry.name, f), 'utf8')
      }))
  }
  return []
})

const existing: ExistingWorkMeeting[] = existsSync(meetingsDir)
  ? readdirSync(meetingsDir)
      .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
      .map((f) => ({ fileName: f }))
  : []

const plan = planWorkMeetingImport({ obsidian, existing })

console.log(`Vault Meetings folder : ${folder} (${obsidian.length} notes)`)
console.log(`Meetings folder       : ${meetingsDir} (${existing.length} already there)`)
console.log(
  apply
    ? 'Mode                  : APPLY (writing files)\n'
    : 'Mode                  : dry run (nothing will be written)\n'
)

const describe = (item: WorkPlanItem): string[] => {
  switch (item.status) {
    case 'import': {
      const m = item.meta
      const facts = [m.series, formatDate(m.date), `${m.attendees.length} attendees`]
      return [
        `import   ${item.target}   <- ${item.source}`,
        `           ${facts.join(' · ')}`,
        ...item.notes.map((n) => `           note: ${n}`)
      ]
    }
    case 'skip-exists':
      return [`skip     ${item.source}   ${item.reason}`]
    case 'attention':
      return [`ATTENTION ${item.source}`, ...item.problems.map((p) => `           ${p}`)]
  }
}
for (const item of plan.items) for (const line of describe(item)) console.log(line)

const toWrite = plan.items.filter(
  (i): i is Extract<WorkPlanItem, { status: 'import' }> => i.status === 'import'
)
const count = (s: WorkPlanItem['status']): number => plan.items.filter((i) => i.status === s).length
console.log(
  `\n${toWrite.length} to import, ${count('skip-exists')} already there, ${count('attention')} need attention.`
)

const names = [...new Set(toWrite.flatMap((i) => i.meta.attendees))].sort()
console.log(`\n${names.length} distinct attendee name(s) across the meetings to import:`)
for (const n of names) console.log(`  ${n}`)

async function run(): Promise<void> {
  if (apply) {
    let written = 0
    for (const item of toWrite) {
      if (await createNoteFileExclusive(join(meetingsDir, item.target), item.content)) written++
      else console.log(`Skipped ${item.target}: it appeared since planning.`)
    }
    console.log(`\nWrote ${written} meeting file(s) to ${meetingsDir}.`)
  }
  console.log(
    apply
      ? '\nOpen the app (or restart it) and the meetings will appear.'
      : '\nDry run only. Re-run with --apply to write these files.'
  )
}
void run()
