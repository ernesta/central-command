/**
 * Copy skills and missing times from the Inkpath log's supervisor and lab meetings into your meeting files.
 *
 *   npm run reconcile:meetings -- --inkpath <the .xlsx>            # dry run
 *   npm run reconcile:meetings -- --inkpath <the .xlsx> --apply    # writes
 *
 * A meeting file gets `skills` when it has none, and `start` and `end` when it has neither. Every time that
 * differs between the log and a file is reported and never overwritten. Writes go through the same guarded
 * save as the app (only the listed keys change, the note text is untouched, and a file that changed since it
 * was read is left alone). Options: --meetings <dir> (default: the research meetings folder).
 */
import { existsSync, readFileSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join, resolve } from 'path'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { applyChanges, parseMeta, splitNote } from '../src/modules/meetings/shared/front-matter'
import { parseInkpathRows } from '../src/modules/training/main/import/inkpath'
import {
  planReconcile,
  type MeetingFileInfo
} from '../src/modules/training/main/import/reconcile-meetings'
import { readXlsxRows } from '../src/modules/training/main/import/xlsx'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const expand = (p: string): string => resolve(p.replace(/^~(?=$|\/)/, homedir()))
const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}

const inkpathArg = arg('inkpath')
if (!inkpathArg) fail('Usage: npm run reconcile:meetings -- --inkpath <the .xlsx> [--apply]')
const apply = process.argv.includes('--apply')
const home = process.env.CENTRAL_COMMAND_HOME || homedir()
const meetingsDir = arg('meetings')
  ? expand(arg('meetings') as string)
  : join(home, 'CentralCommand', 'notes', 'meetings', 'research')
if (!existsSync(meetingsDir)) fail(`Meetings folder not found: ${meetingsDir}`)

const workbook = parseInkpathRows(readXlsxRows(readFileSync(expand(inkpathArg as string))))
if (workbook.problems.length) fail(workbook.problems.join('\n'))

const files: MeetingFileInfo[] = readdirSync(meetingsDir)
  .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
  .map((f) => {
    const { meta } = parseMeta(splitNote(readFileSync(join(meetingsDir, f), 'utf8')).head)
    return {
      fileName: f,
      date: meta.date,
      series: meta.series,
      start: meta.start,
      end: meta.end,
      skills: meta.skills
    }
  })

const plan = planReconcile(workbook.rows, files)
console.log(`Meetings folder : ${meetingsDir} (${files.length} files)`)
console.log(
  apply
    ? 'Mode            : APPLY (writing files)\n'
    : 'Mode            : dry run (nothing will be written)\n'
)

for (const item of plan.items) {
  if (item.status === 'update') {
    const p = item.patch
    console.log(
      `update   ${item.fileName}   <- ${item.source}\n           ${[p.skills ? `skills: ${p.skills.join(', ')}` : '', p.start ? `times: ${p.start}–${p.end}` : ''].filter(Boolean).join(' · ')}`
    )
  } else if (item.status === 'ok') {
    console.log(`ok       ${item.fileName}`)
  } else console.log(`no file  ${item.source}`)
  if (item.status !== 'no-file') for (const n of item.notes) console.log(`           note: ${n}`)
}

if (plan.timeDifferences.length) {
  console.log('\nTimes that differ between the log and the file (the file was left as it is):')
  for (const d of plan.timeDifferences) console.log(`  ${d.fileName}: file ${d.file}, log ${d.log}`)
}

const updates = plan.items.filter(
  (i): i is Extract<typeof i, { status: 'update' }> => i.status === 'update'
)
console.log(
  `\n${updates.length} to update, ${plan.items.filter((i) => i.status === 'ok').length} already agree, ${plan.items.filter((i) => i.status === 'no-file').length} without a meeting file.`
)

async function run(): Promise<void> {
  if (apply) {
    let written = 0
    for (const item of updates) {
      const path = join(meetingsDir, item.fileName)
      const disk = await readNoteFile(path)
      if (!disk.exists) continue
      const next = applyChanges(disk.content, { meta: item.patch })
      const { result, wrote } = await writeNoteFileGuarded(path, next, disk.hash)
      if (wrote) written++
      else if (result.status === 'conflict')
        console.log(`Left ${item.fileName} alone: it changed while reading.`)
    }
    console.log(`\nUpdated ${written} meeting file(s).`)
  } else console.log('\nDry run only. Re-run with --apply to write these changes.')
}
void run()
