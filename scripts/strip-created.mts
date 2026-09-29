/**
 * One-off clean-up: remove the `created:` line from the front matter of every note, since Notes no longer shows or
 * keeps a creation date.
 *
 *   npm run strip:created                 # dry run: lists the notes it would change, writes nothing
 *   npm run strip:created -- --apply      # rewrites them (after copying each to a backup folder)
 *
 * Only that one line goes: the text and every other front matter line stay exactly as they were, and each result is
 * checked (same text, every other line identical) before it is written; a note that fails is left alone and reported.
 * Applying copies every note it changes to `~/CentralCommand/backups/strip-created-<time>/` first, and writes with the
 * same content-hash guard as the app: a note that changed since it was read is skipped. Close the app before applying.
 *
 * Options: --workspaces research,work (default both).
 */
import { mkdir } from 'fs/promises'
import { existsSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { writeFileAtomic } from '../src/main/atomic-write'
import { joinNote, parseHead, splitNote, updateHeadKeys } from '../src/shared/front-matter'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const apply = process.argv.includes('--apply')
const home = process.env.CENTRAL_COMMAND_HOME || homedir()
const dataRoot = join(home, 'CentralCommand')
const workspaces = (arg('workspaces') ?? 'research,work').split(',').map((w) => w.trim())

const linesOf = (head: string): string[] => {
  const parsed = parseHead(head)
  return parsed ? [...parsed.leading, ...parsed.entries.flatMap((e) => e.lines)] : []
}

/** The note with its `created` entry removed, or what is wrong. */
function strip(content: string): { next: string } | { problem: string } | null {
  const { head, body } = splitNote(content)
  const parsed = parseHead(head)
  if (!parsed || !parsed.entries.some((e) => e.key === 'created')) return null
  const removed = parsed.entries.filter((e) => e.key === 'created').flatMap((e) => e.lines)
  const newHead = updateHeadKeys(head, { created: null }, { order: ['created'] })
  const before = linesOf(head)
  const after = linesOf(newHead)
  const expected = [...before]
  for (const line of removed) expected.splice(expected.indexOf(line), 1)
  if (after.join('\n') !== expected.join('\n'))
    return { problem: 'the other front matter lines would change' }
  const { body: newBody } = splitNote(newHead + body)
  if (newBody !== body) return { problem: 'the text would change' }
  // With nothing else left in the block, the block goes too.
  const empty = (parseHead(newHead)?.entries.length ?? 0) === 0
  return { next: joinNote({ head: empty ? '' : newHead, body }) }
}

async function run(): Promise<void> {
  console.log(
    apply
      ? 'Mode : APPLY (rewriting notes, with backups)\n'
      : 'Mode : dry run (nothing will be written)\n'
  )
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(dataRoot, 'backups', `strip-created-${stamp}`)
  let changed = 0
  let failed = 0
  for (const workspace of workspaces) {
    const dir = join(dataRoot, 'notes', 'notes', workspace)
    if (!existsSync(dir)) {
      console.log(`${workspace}: no folder (${dir})`)
      continue
    }
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
      .sort()) {
      const path = join(dir, file)
      const note = await readNoteFile(path)
      const result = strip(note.content)
      if (result === null) continue
      if ('problem' in result) {
        failed++
        console.log(`LEFT ALONE ${workspace}/${file}: ${result.problem}`)
        continue
      }
      console.log(`${workspace}/${file}: created line removed`)
      if (!apply) {
        changed++
        continue
      }
      await mkdir(join(backupDir, workspace), { recursive: true })
      await writeFileAtomic(join(backupDir, workspace, file), note.content)
      const { result: written, wrote } = await writeNoteFileGuarded(path, result.next, note.hash)
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
