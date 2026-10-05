/**
 * One-off converter: write the TODOs in your meeting notes as checkboxes, so they can be ticked in the note and on the Meetings page.
 *
 *   npm run convert:todos                 # dry run: shows every line it would change, writes nothing
 *   npm run convert:todos -- --apply      # rewrites those notes (after copying each to a backup folder)
 *
 * A line with `**TODO(EO)**: text` becomes `- [ ] **TODO(EO)**: text` (an existing bullet is kept; several TODOs on one line
 * become one checkbox each). Lines that are already checkboxes, headings, quotes, table rows and code are left alone, and
 * ticked boxes stay ticked. Each result is checked (the TODOs read back the same, nothing newly ticked, every other line
 * identical); a note that fails the check is left as it is and reported.
 *
 * Applying copies every note it changes to `~/CentralCommand/backups/todo-boxes-<time>/` first, and writes with the same
 * content-hash guard as the app: a note that changed since it was read is skipped. Close the app before applying.
 *
 * Options: --meetings <dir> (default: both ~/CentralCommand/notes/meetings/research and .../work).
 */
import { mkdir } from 'fs/promises'
import { existsSync, readdirSync } from 'fs'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { homedir } from 'os'
import { basename, join, resolve } from 'path'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { writeFileAtomic } from '../src/main/atomic-write'
import { joinNote, splitNote } from '../src/modules/meetings/shared/front-matter'
import { checkTodoConversion, convertTodoBoxes } from '../src/modules/meetings/shared/todo-boxes'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const expand = (p: string): string => resolve(p.replace(/^~(?=$|\/)/, homedir()))

const apply = process.argv.includes('--apply')
const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const dataRoot = join(home, 'CentralCommand')
const dirs = arg('meetings')
  ? [expand(arg('meetings') as string)]
  : ['research', 'work'].map((w) => join(dataRoot, 'notes', 'meetings', w))
for (const dir of dirs) {
  if (!existsSync(dir)) {
    console.error(`Meetings folder not found: ${dir}`)
    process.exit(1)
  }
  console.log(`Meetings folder : ${dir}`)
}
console.log(
  apply
    ? 'Mode            : APPLY (rewriting notes, with backups)\n'
    : 'Mode            : dry run (nothing will be written)\n'
)

async function run(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(dataRoot, 'backups', `todo-boxes-${stamp}`)
  let changedFiles = 0
  let changedLines = 0
  let failed = 0

  for (const dir of dirs) {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
      .sort()
    for (const file of files) {
      const path = join(dir, file)
      const note = await readNoteFile(path)
      const { head, body } = splitNote(note.content)
      const r = convertTodoBoxes(body)
      if (r.converted.length === 0) continue

      const label = `${basename(dir)}/${file}`
      console.log(label)
      for (const c of r.converted) {
        console.log(`  line ${c.line + 1}: ${c.from.trim()}`)
        for (const t of c.to) console.log(`      ->  ${t.trim()}`)
      }
      const problems = checkTodoConversion(body, r.body)
      if (problems.length > 0) {
        failed++
        console.log(`  NOT CHANGED: ${problems.join('; ')}`)
        continue
      }
      if (!apply) {
        changedFiles++
        changedLines += r.converted.length
        continue
      }
      await mkdir(join(backupDir, basename(dir)), { recursive: true })
      await writeFileAtomic(join(backupDir, basename(dir), file), note.content)
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
  }

  console.log(
    `\n${changedLines} line(s) in ${changedFiles} note(s) ${apply ? 'converted' : 'would be converted'}` +
      `${failed ? `, ${failed} not changed (see above)` : ''}.`
  )
  if (apply && changedFiles > 0) console.log(`Originals are in ${backupDir}`)
  if (!apply) console.log('Dry run only. Re-run with --apply to rewrite these notes.')
}
void run()
