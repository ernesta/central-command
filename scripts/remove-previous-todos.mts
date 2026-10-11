/**
 * One-off clean-up (requested 11 Oct 2026): remove the whole `## Previous TODOs` section (heading and
 * everything under it, up to the next heading) from every meeting note.
 *
 *   npm run remove:previous-todos                # dry run: lists the notes it would change, writes nothing
 *   npm run remove:previous-todos -- --apply     # rewrites them (after copying each to a backup folder)
 *
 * Only that section goes: every other line keeps its exact text and order, checked before each result is
 * written; a note where that check fails is left alone and reported. A note with no `## Previous TODOs`
 * heading is skipped. Applying copies every note it changes to
 * `~/CentralCommand/backups/remove-previous-todos-<time>/` first, and writes with the app's content-hash
 * guard: a note that changed since it was read is skipped. Close the app before applying.
 *
 * This only removes what is currently written under the heading; the app's carry-over still recreates the
 * section next time a meeting note is opened or a new one is made for the series (`insertPreviousTodos`,
 * `src/modules/meetings/shared/carry-over.ts`) — ticked items will not come back, but unticked ones will.
 *
 * Options: --workspaces research,work (default both).
 */
import { mkdir } from 'fs/promises'
import { existsSync, readdirSync } from 'fs'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { homedir } from 'os'
import { join } from 'path'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { writeFileAtomic } from '../src/main/atomic-write'
import { splitNote, joinNote } from '../src/shared/front-matter'
import { scan, parseHeading } from '../src/shared/sections'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const apply = process.argv.includes('--apply')
const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const dataRoot = join(home, 'CentralCommand')
const workspaces = (arg('workspaces') ?? 'research,work').split(',').map((w) => w.trim())

const nonBlank = (t: string): string[] => t.split('\n').filter((l) => l.trim() !== '')

/** The body with its `## Previous TODOs` section removed, or what is wrong, or null if there is none. */
function remove(body: string): { next: string } | { problem: string } | null {
  const { lines } = scan(body)
  const headings = lines.flatMap((l, i) => {
    const h = l.inFence ? null : parseHeading(l.text)
    return h ? [{ ...h, i }] : []
  })
  const at = headings.findIndex((h) => h.level === 2 && h.text.toLowerCase() === 'previous todos')
  if (at === -1) return null
  const start = lines[headings[at].i].start
  const next = headings.slice(at + 1).find((h) => h.level <= 2)
  const stop = next ? lines[next.i].start : body.length
  const result = body.slice(0, start) + body.slice(stop)

  const expected = [...nonBlank(body.slice(0, start)), ...nonBlank(body.slice(stop))]
  if (expected.join('\n') !== nonBlank(result).join('\n'))
    return { problem: 'text other than the section would change' }
  return { next: result }
}

async function run(): Promise<void> {
  console.log(
    apply
      ? 'Mode : APPLY (rewriting notes, with backups)\n'
      : 'Mode : dry run (nothing will be written)\n'
  )
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(dataRoot, 'backups', `remove-previous-todos-${stamp}`)
  let changed = 0
  let failed = 0
  for (const workspace of workspaces) {
    const dir = join(dataRoot, 'notes', 'meetings', workspace)
    if (!existsSync(dir)) {
      console.log(`${workspace}: no folder (${dir})`)
      continue
    }
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
      .sort()) {
      const path = join(dir, file)
      const note = await readNoteFile(path)
      const { head, body } = splitNote(note.content)
      const result = remove(body)
      if (result === null) continue
      if ('problem' in result) {
        failed++
        console.log(`LEFT ALONE ${workspace}/${file}: ${result.problem}`)
        continue
      }
      console.log(`${workspace}/${file}: Previous TODOs section removed`)
      if (!apply) {
        changed++
        continue
      }
      await mkdir(join(backupDir, workspace), { recursive: true })
      await writeFileAtomic(join(backupDir, workspace, file), note.content)
      const next = joinNote({ head, body: result.next })
      const { result: written, wrote } = await writeNoteFileGuarded(path, next, note.hash)
      if (written.status === 'conflict') {
        failed++
        console.log('  SKIPPED: the file changed while this ran; nothing was written to it.')
      } else if (wrote) changed++
    }
  }
  console.log(
    `\n${changed} note(s) ${apply ? 'changed' : 'would change'}${failed ? `, ${failed} left alone` : ''}.`
  )
  if (apply && changed > 0) console.log(`Originals are in ${backupDir}`)
  if (!apply) console.log('Dry run only. Re-run with --apply to rewrite these notes.')
}

void run()
