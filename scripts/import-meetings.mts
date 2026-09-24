/**
 * One-off importer: bring your existing meeting notes into Central Command's meetings folder.
 *
 *   npm run import:meetings -- --vault ~/path/to/vault --meeting-notes ~/path/to/"Meeting Notes"           # dry run
 *   npm run import:meetings -- --vault ~/path/to/vault --meeting-notes ~/path/to/"Meeting Notes" --apply    # writes files
 *
 * Sources (read only, never modified): the Obsidian meeting notes (a "Meetings" folder in the vault, with a
 * "Supervision" sub-folder), the Word supervisor log (a .doc or .docx whose name ends in "Log") and the Word
 * meeting notes in "Supervisors/" (for start and end times). Word files are read with macOS `textutil`.
 *
 * Options: --folder <path inside the vault> (default: found automatically), --meetings <dir> (where meetings are
 * written), --add-people (also add the attendees to your people list, with initials worked out from their names).
 * Never overwrites an existing meeting; running it again after an import writes nothing.
 */
import { execFileSync } from 'child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { join, resolve } from 'path'
import { createNoteFileExclusive } from '../src/main/notes/guarded-file'
import { PeopleStore } from '../src/modules/meetings/main/people-store'
import {
  planMeetingImport,
  type ExistingMeeting,
  type PlanItem
} from '../src/modules/meetings/main/import/meeting-import'
import { parseMeta, splitNote } from '../src/modules/meetings/shared/front-matter'
import { formatDate, formatDuration, durationMinutes } from '../src/modules/meetings/shared/time'

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
const notesArg = arg('meeting-notes')
if (!vaultArg || !notesArg) {
  fail(
    'Usage: npm run import:meetings -- --vault <path to vault> --meeting-notes <path to the Meeting Notes folder> [--apply] [--add-people]'
  )
}
if (process.platform !== 'darwin') fail('This importer reads Word files with macOS `textutil`, so it only runs on a Mac.')
const apply = process.argv.includes('--apply')
const addPeople = process.argv.includes('--add-people')
const vault = expand(vaultArg as string)
const meetingNotes = expand(notesArg as string)
const home = process.env.CENTRAL_COMMAND_HOME || homedir()
const dataRoot = join(home, 'CentralCommand')
const meetingsDir = arg('meetings') ? expand(arg('meetings') as string) : join(dataRoot, 'notes', 'meetings', 'research')
const peopleFile = join(dataRoot, 'data', 'people.json')

const isDir = (p: string): boolean => existsSync(p) && statSync(p).isDirectory()
if (!isDir(vault)) fail(`Vault not found: ${vault}`)
if (!isDir(meetingNotes)) fail(`Meeting Notes folder not found: ${meetingNotes}`)

// --- find the Obsidian meetings folder
let folder = arg('folder') ? join(vault, arg('folder') as string) : ''
if (!folder) {
  const candidates = [join(vault, 'Meetings'), join(vault, 'RHUL', 'Meetings')]
  folder = candidates.find(isDir) ?? ''
  if (!folder) {
    folder =
      readdirSync(vault)
        .map((d) => join(vault, d))
        .filter(isDir)
        .flatMap((d) => readdirSync(d).map((s) => join(d, s)))
        .find((p) => p.endsWith('/Meetings') && isDir(p)) ?? ''
  }
}
if (!folder || !isDir(folder)) fail('Could not find the Meetings folder in the vault. Pass --folder <path inside the vault>.')

const textutil = (file: string): string =>
  execFileSync('textutil', ['-convert', 'txt', '-stdout', file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

// --- read the sources
const obsidian = readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
  if (entry.name.startsWith('.')) return []
  if (entry.isFile() && entry.name.endsWith('.md')) {
    return [{ fileName: entry.name, folder: '', text: readFileSync(join(folder, entry.name), 'utf8') }]
  }
  if (entry.isDirectory()) {
    return readdirSync(join(folder, entry.name))
      .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
      .map((f) => ({ fileName: f, folder: entry.name, text: readFileSync(join(folder, entry.name, f), 'utf8') }))
  }
  return []
})

const supervisorsDir = join(meetingNotes, 'Supervisors')
const wordNotes = isDir(supervisorsDir)
  ? readdirSync(supervisorsDir)
      .filter((f) => /\.docx?$/i.test(f) && !f.startsWith('~$') && !f.startsWith('.'))
      .map((f) => ({ fileName: f, text: textutil(join(supervisorsDir, f)) }))
  : []
const logFile = readdirSync(meetingNotes).find((f) => /log\.docx?$/i.test(f) && !f.startsWith('~$'))
const logText = logFile ? textutil(join(meetingNotes, logFile)) : null

const existing: ExistingMeeting[] = existsSync(meetingsDir)
  ? readdirSync(meetingsDir)
      .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
      .map((f) => {
        const { meta } = parseMeta(splitNote(readFileSync(join(meetingsDir, f), 'utf8')).head)
        return { fileName: f, date: meta.date, series: meta.series }
      })
  : []

const plan = planMeetingImport({ obsidian, wordNotes, logText, existing })

console.log(`Obsidian meetings : ${folder} (${obsidian.length} notes)`)
console.log(`Word notes        : ${supervisorsDir} (${wordNotes.length} files)`)
console.log(`Word log          : ${logFile ? join(meetingNotes, logFile) : 'not found'}`)
console.log(`Meetings folder   : ${meetingsDir} (${existing.length} already there)`)
console.log(apply ? 'Mode              : APPLY (writing files)\n' : 'Mode              : dry run (nothing will be written)\n')

const describe = (item: PlanItem): string[] => {
  switch (item.status) {
    case 'import': {
      const m = item.meta
      const minutes = durationMinutes(m.start, m.end)
      const facts = [
        m.series,
        formatDate(m.date),
        m.start ? `${m.start}–${m.end}${minutes ? ` (${formatDuration(minutes)})` : ''}` : 'no times',
        m.mode === 'online' ? 'Online' : m.mode === 'in-person' ? 'In person' : 'no type',
        `${m.attendees.length} attendees`
      ]
      return [`import   ${item.target}   <- ${item.source}`, `           ${facts.join(' · ')}`, ...item.notes.map((n) => `           note: ${n}`)]
    }
    case 'skip-exists':
      return [`skip     ${item.source}   ${item.reason}`]
    case 'attention':
      return [`ATTENTION ${item.source}`, ...item.problems.map((p) => `           ${p}`)]
  }
}
for (const item of plan.items) for (const line of describe(item)) console.log(line)

if (plan.anomalies.length) {
  console.log('\nThings that did not line up:')
  for (const a of plan.anomalies) console.log(`  - ${a}`)
}

const toWrite = plan.items.filter((i): i is Extract<PlanItem, { status: 'import' }> => i.status === 'import')
const count = (s: PlanItem['status']): number => plan.items.filter((i) => i.status === s).length
console.log(`\n${toWrite.length} to import, ${count('skip-exists')} already there, ${count('attention')} need attention.`)

const r = plan.reminders
if (r.dateMismatches.length || r.durationMismatches.length || r.noTimes.length) {
  console.log('\nPlease check these yourself (nothing here was changed in your notes):')
  if (r.dateMismatches.length) {
    console.log('  Wrong dates in Obsidian **Date** lines (the file name date was used):')
    for (const d of r.dateMismatches) console.log(`    ${d.source}: says ${formatDate(d.headerDate)}, used ${formatDate(d.usedDate)}`)
  }
  if (r.durationMismatches.length) {
    console.log('  Durations that differ between the Word log and the Word note (the note\'s times were used):')
    for (const d of r.durationMismatches) console.log(`    ${formatDate(d.date)}: log ${d.logMinutes} min, note ${d.noteMinutes} min`)
  }
  if (r.noTimes.length) {
    console.log('  Meetings with no Word note, so no start and end times (add them in the app):')
    for (const n of r.noTimes) console.log(`    ${n.series} · ${formatDate(n.date)} (${n.source})`)
  }
}

const names = [...new Set(toWrite.flatMap((i) => i.meta.attendees))]
if (addPeople) {
  console.log('\nPeople to add to your list (initials worked out from the names; change them in Settings):')
}

async function run(): Promise<void> {
  if (apply) {
    let written = 0
    for (const item of toWrite) {
      if (await createNoteFileExclusive(join(meetingsDir, item.target), item.content)) written++
      else console.log(`Skipped ${item.target}: it appeared since planning.`)
    }
    console.log(`\nWrote ${written} meeting file(s) to ${meetingsDir}.`)
  }
  if (addPeople) {
    const store = new PeopleStore(peopleFile)
    await store.load()
    const known = new Set(store.list().map((p) => p.name.toLowerCase()))
    for (const name of names) {
      if (known.has(name.toLowerCase())) continue
      if (!apply) {
        console.log(`  ${name}`)
        continue
      }
      try {
        const list = await store.add({ name })
        console.log(`  added ${name} (${list[list.length - 1].initials})`)
      } catch (error) {
        console.log(`  could not add ${name}: ${(error as Error).message}`)
      }
    }
  }
  console.log(apply ? '\nOpen the app (or restart it) and the meetings will appear.' : '\nDry run only. Re-run with --apply to write these files.')
}
void run()
