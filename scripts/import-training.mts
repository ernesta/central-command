/**
 * One-off importer: bring your Inkpath training log into Central Command's training folder.
 *
 *   npm run import:training -- --inkpath ~/RHUL/Trainings/"2025-26 Inkpath Training Log.xlsx"                 # dry run
 *   npm run import:training -- --inkpath <xlsx> --obsidian ~/vault/RHUL/Training --trainings ~/RHUL/Trainings  # with notes and folders
 *   npm run import:training -- --inkpath <xlsx> --apply                                                          # writes files
 *
 * Sources (read only, never modified): the Inkpath .xlsx, optionally the Obsidian Training notes folder
 * (`--obsidian`) and the Trainings folder (`--trainings`, to link each entry's folder). Supervisor and lab
 * meetings in the workbook are left out (they belong to Meetings; see `npm run reconcile:meetings`).
 *
 * Options: --training <dir> (where entries are written), --add-people (add note leads to your people list).
 * Nothing is guessed: what does not fit is reported and left out or left empty. Never overwrites an existing
 * entry; running it again after an import writes nothing.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { basename, join, relative, resolve } from 'path'
import { createNoteFileExclusive } from '../src/main/notes/guarded-file'
import { PeopleStore } from '../src/modules/meetings/main/people-store'
import { readXlsxRows } from '../src/modules/training/main/import/xlsx'
import { parseInkpathRows } from '../src/modules/training/main/import/inkpath'
import {
  planTrainingImport,
  type ExistingEntry,
  type ImportItem,
  type TrainingFolder
} from '../src/modules/training/main/import/training-import'
import { parseTrainingMeta, splitNote } from '../src/modules/training/shared/front-matter'
import { formatDate, formatDuration } from '../src/shared/time'
import { formatHours } from '../src/shared/skills'
import type { ObsidianTrainingNote } from '../src/modules/training/main/import/obsidian-notes'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const expand = (p: string): string => resolve(p.replace(/^~(?=$|\/)/, homedir()))
const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}
const isDir = (p: string): boolean => existsSync(p) && statSync(p).isDirectory()

const inkpathArg = arg('inkpath')
if (!inkpathArg) {
  fail(
    'Usage: npm run import:training -- --inkpath <the .xlsx> [--obsidian <Training notes folder>] [--trainings <Trainings folder>] [--apply] [--add-people]'
  )
}
const apply = process.argv.includes('--apply')
const addPeople = process.argv.includes('--add-people')
const inkpath = expand(inkpathArg as string)
if (!existsSync(inkpath)) fail(`Workbook not found: ${inkpath}`)
const home = process.env.CENTRAL_COMMAND_HOME || homedir()
const dataRoot = join(home, 'CentralCommand')
const trainingDir = arg('training')
  ? expand(arg('training') as string)
  : join(dataRoot, 'notes', 'training', 'research')
const peopleFile = join(dataRoot, 'data', 'people.json')

// --- read the sources
const workbook = parseInkpathRows(readXlsxRows(readFileSync(inkpath)))
if (workbook.problems.length) fail(workbook.problems.join('\n'))

const notes: ObsidianTrainingNote[] = []
const obsidianArg = arg('obsidian')
if (obsidianArg) {
  const root = expand(obsidianArg)
  if (!isDir(root)) fail(`Obsidian folder not found: ${root}`)
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.md'))
        notes.push({
          path: relative(root, path),
          fileName: entry.name,
          text: readFileSync(path, 'utf8')
        })
    }
  }
  walk(root)
}

const folders: TrainingFolder[] = []
const trainingsArg = arg('trainings')
if (trainingsArg) {
  const root = expand(trainingsArg)
  if (!isDir(root)) fail(`Trainings folder not found: ${root}`)
  // year / programme / dated folder
  for (const year of readdirSync(root, { withFileTypes: true })) {
    if (!year.isDirectory() || year.name.startsWith('.')) continue
    for (const programme of readdirSync(join(root, year.name), { withFileTypes: true })) {
      if (!programme.isDirectory() || programme.name.startsWith('.')) continue
      for (const dated of readdirSync(join(root, year.name, programme.name), {
        withFileTypes: true
      })) {
        if (dated.isDirectory() && !dated.name.startsWith('.'))
          folders.push({ path: `${year.name}/${programme.name}/${dated.name}` })
      }
    }
  }
}

const existing: ExistingEntry[] = existsSync(trainingDir)
  ? readdirSync(trainingDir)
      .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
      .map((f) => {
        const { meta } = parseTrainingMeta(
          splitNote(readFileSync(join(trainingDir, f), 'utf8')).head
        )
        return { fileName: f, date: meta.date, title: meta.title }
      })
  : []

const plan = planTrainingImport({ rows: workbook.rows, notes, folders, existing })

console.log(`Inkpath workbook  : ${inkpath} (${workbook.rows.length} rows)`)
console.log(
  `Obsidian notes    : ${obsidianArg ? `${obsidianArg} (${notes.length} notes)` : 'not given'}`
)
console.log(
  `Trainings folder  : ${trainingsArg ? `${trainingsArg} (${folders.length} folders)` : 'not given'}`
)
console.log(`Training folder   : ${trainingDir} (${existing.length} already there)`)
console.log(
  apply
    ? 'Mode              : APPLY (writing files)\n'
    : 'Mode              : dry run (nothing will be written)\n'
)

const describe = (item: ImportItem): string[] => {
  switch (item.status) {
    case 'import': {
      const p = item.patch
      const facts = [
        formatDate(p.date as string),
        p.start
          ? `${p.start}–${p.end}${item.minutes ? ` (${formatDuration(item.minutes)})` : ''}`
          : 'no times',
        p.series ?? 'no series',
        p.mode ?? 'no format',
        `${(p.skills ?? []).length} skills`,
        p.folder ? `folder ${p.folder}` : 'no folder',
        item.matchedNote ? `note ${item.matchedNote}` : 'no note'
      ]
      return [
        `import   ${item.target}   <- ${item.source}`,
        `           ${facts.join(' · ')}`,
        ...item.notes.map((n) => `           note: ${n}`),
        ...(p.review ? [`           TO REVIEW: ${p.review}`] : [])
      ]
    }
    case 'skip-exists':
      return [`skip     ${item.source}   ${item.reason}`]
    case 'attention':
      return [`ATTENTION ${item.source}`, ...item.problems.map((p) => `           ${p}`)]
  }
}
for (const item of plan.items) for (const line of describe(item)) console.log(line)

const r = plan.reports
console.log('\nLeft for Meetings (supervisor and lab meetings):')
for (const m of plan.meetings) console.log(`  ${formatDate(m.startDate)}  ${m.name}`)

if (r.hoursDiffer.length) {
  console.log('\nHours typed in Inkpath that differ from the times (the app uses the times):')
  for (const d of r.hoursDiffer)
    console.log(
      `  ${formatDate(d.row.startDate)} ${d.row.name}: typed ${d.typed} h, times give ${formatHours(d.fromTimes)}`
    )
}
if (r.peopleProviders.length) {
  console.log(
    '\nProviders that look like people (kept as the institution; add leads yourself if you want them):'
  )
  for (const p of r.peopleProviders) console.log(`  ${p.provider} (${p.count})`)
}
if (r.unknownSkills.length) {
  console.log('\nSkills that are not on the skills list (left out):')
  for (const s of r.unknownSkills) console.log(`  ${s.skill} (rows ${s.rows.join(', ')})`)
}
if (r.unmatchedNotes.length) {
  console.log('\nObsidian notes that could not be matched (nothing was imported from them):')
  for (const n of r.unmatchedNotes) console.log(`  ${n.path}: ${n.reason}`)
}
if (r.unmatchedFolders.length && trainingsArg) {
  console.log('\nEntries whose folder could not be linked:')
  for (const u of r.unmatchedFolders)
    console.log(`  ${formatDate(u.row.startDate)} ${u.row.name}: ${u.reason}`)
}

const count = (s: ImportItem['status']): number => plan.items.filter((i) => i.status === s).length
const toWrite = plan.items.filter(
  (i): i is Extract<ImportItem, { status: 'import' }> => i.status === 'import'
)
console.log(
  `\n${toWrite.length} to import, ${count('skip-exists')} already there, ${count('attention')} need attention, ${plan.meetings.length} left for Meetings, ${toWrite.filter((i) => i.patch.review).length} to review, ${r.withoutType} without a type (choose one in the app).`
)
const t = plan.totals
console.log(
  `Check: source ${t.sourceEntries} entries, ${formatHours(t.sourceMinutes)}; planned ${t.plannedEntries} entries, ${formatHours(t.plannedMinutes)}.` +
    (t.plannedEntries + count('skip-exists') + count('attention') === t.sourceEntries
      ? ' Every source entry is accounted for.'
      : ' MISMATCH: some entries are unaccounted for.')
)

async function run(): Promise<void> {
  if (apply) {
    let written = 0
    for (const item of toWrite) {
      if (await createNoteFileExclusive(join(trainingDir, item.target), item.content)) written++
      else console.log(`Skipped ${basename(item.target)}: it appeared since planning.`)
    }
    console.log(`\nWrote ${written} entry file(s) to ${trainingDir}.`)
  }
  if (addPeople) {
    const store = new PeopleStore(peopleFile)
    await store.load()
    const known = new Set(store.list().map((p) => p.name.toLowerCase()))
    const names = [...new Set(toWrite.flatMap((i) => i.leads))]
    console.log('\nLeads to add to your people list:')
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
  console.log(
    apply
      ? '\nOpen the app (or restart it) and the entries will appear.'
      : '\nDry run only. Re-run with --apply to write these files.'
  )
}
void run()
