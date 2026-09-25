/**
 * One-off converter: turn bold pseudo-headings in your meeting notes into real topics.
 *
 *   npm run convert:topics                 # dry run: shows every line it would change, writes nothing
 *   npm run convert:topics -- --apply      # rewrites those notes (after copying each to a backup folder)
 *
 * A line under `## Notes` that is only a bold title (`**Ethics Application**`) becomes `### Ethics Application`,
 * which the meeting page lists as a topic. Nothing else in a note changes. A note that already has ### topics is
 * left alone. Each result is checked (same line count, every other line identical, TODOs unchanged); a note that
 * fails the check is left as it is and reported.
 *
 * Applying copies every note it changes to `~/CentralCommand/backups/topic-headings-<time>/` first, and writes
 * with the same content-hash guard as the app: a note that changed since it was read is skipped. Close the app
 * (or at least the meeting) before applying.
 *
 * Options: --meetings <dir> (default: ~/CentralCommand/notes/meetings/research).
 */
import { mkdir } from 'fs/promises'
import { existsSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join, resolve } from 'path'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { writeFileAtomic } from '../src/main/atomic-write'
import { joinNote, splitNote } from '../src/modules/meetings/shared/front-matter'
import { convertPseudoHeadings } from '../src/modules/meetings/shared/pseudo-headings'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const expand = (p: string): string => resolve(p.replace(/^~(?=$|\/)/, homedir()))

const apply = process.argv.includes('--apply')
const home = process.env.CENTRAL_COMMAND_HOME || homedir()
const dataRoot = join(home, 'CentralCommand')
const meetingsDir = arg('meetings')
  ? expand(arg('meetings') as string)
  : join(dataRoot, 'notes', 'meetings', 'research')
if (!existsSync(meetingsDir)) {
  console.error(`Meetings folder not found: ${meetingsDir}`)
  process.exit(1)
}

console.log(`Meetings folder : ${meetingsDir}`)
console.log(
  apply
    ? 'Mode            : APPLY (rewriting notes, with backups)\n'
    : 'Mode            : dry run (nothing will be written)\n'
)

async function run(): Promise<void> {
  const files = readdirSync(meetingsDir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
    .sort()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(dataRoot, 'backups', `topic-headings-${stamp}`)
  let changedFiles = 0
  let changedLines = 0
  let failed = 0
  const untouched: string[] = []

  for (const file of files) {
    const path = join(meetingsDir, file)
    const note = await readNoteFile(path)
    const { head, body } = splitNote(note.content)
    const r = convertPseudoHeadings(body)

    if (r.converted.length === 0) {
      const notable = r.problems.length > 0 || r.leftAlone.length > 0
      if (notable) {
        untouched.push(
          `${file}\n` +
            [
              ...r.problems.map((p) => `      not changed: ${p}`),
              ...r.leftAlone.map(
                (l) => `      line ${l.line + 1} left alone (${l.reason}): ${l.text}`
              )
            ].join('\n')
        )
      }
      continue
    }

    console.log(file)
    for (const c of r.converted) console.log(`  line ${c.line + 1}: ${c.from.trim()}  ->  ${c.to}`)
    for (const l of r.leftAlone)
      console.log(`  line ${l.line + 1} left alone (${l.reason}): ${l.text}`)

    if (!apply) {
      changedFiles++
      changedLines += r.converted.length
      continue
    }
    await mkdir(backupDir, { recursive: true })
    await writeFileAtomic(join(backupDir, file), note.content)
    const { result, wrote } = await writeNoteFileGuarded(
      path,
      joinNote({ head, body: r.body }),
      note.hash
    )
    if (result.status === 'conflict') {
      failed++
      console.log('  SKIPPED: the file changed while this ran; nothing was written to it.')
    } else if (wrote) {
      changedFiles++
      changedLines += r.converted.length
    }
  }

  if (untouched.length) {
    console.log('\nNotes with bold lines that were not converted:')
    for (const u of untouched) console.log(`  ${u}`)
  }
  console.log(
    `\n${changedLines} line(s) in ${changedFiles} note(s) ${apply ? 'converted' : 'would be converted'}` +
      `${failed ? `, ${failed} skipped` : ''}.`
  )
  if (apply && changedFiles > 0) console.log(`Originals are in ${backupDir}`)
  if (!apply) console.log('Dry run only. Re-run with --apply to rewrite these notes.')
}
void run()
