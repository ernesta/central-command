/**
 * One-off tidy (17 Oct 2026, `docs/UNIFORM_LINES_PLAN.md`, stage 2): remove every single blank line between two lines of text, in
 * every note folder (Readings included): only blank lines go, backed up first. The editor draws every blank line as a whole line of
 * space, so a lone blank line between blocks would look loose. (Written first for paragraph + paragraph only; the user then asked for
 * all of them, so the name stayed.)
 *
 *   npm run tidy:paragraph-blanks                # dry run: lists what it would remove and every blank line it keeps, by kind
 *   npm run tidy:paragraph-blanks -- --apply     # rewrites the notes (after copying each to a backup folder)
 *
 * Outside this app the lines joined would be one paragraph, a lazy list continuation or a table row, so a blank line is removed only
 * when the editor's own parse reads the note the same afterwards (`paragraph-blanks.ts`); the others are kept and listed. Blank lines
 * in code fences, the front matter and runs of two or more are left alone. Each result is checked (every non-blank line identical,
 * in order) and a note that fails is left alone and reported. Applying copies every note it changes to
 * `~/CentralCommand/backups/tidy-paragraph-blanks-<time>/` first; a note that changed since it was read is skipped. Close the
 * app before applying. A second run finds nothing to remove.
 */
import { mkdir } from 'fs/promises'
import { existsSync, readdirSync, statSync } from 'fs'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { homedir } from 'os'
import { dirname, join, relative } from 'path'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { writeFileAtomic } from '../src/main/atomic-write'
import { splitNote } from '../src/shared/front-matter'
import {
  dropLines,
  pairLabel,
  planParagraphBlanks,
  type SingleBlank
} from '../src/renderer/src/editor/paragraph-blanks'

const apply = process.argv.includes('--apply')
const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const notesRoot = join(home, 'CentralCommand', 'notes')

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('.')) return []
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return markdownFiles(path)
    return name.endsWith('.md') ? [path] : []
  })
}

const content = (t: string): string[] => t.split('\n').filter((l) => l.trim() !== '')
const short = (t: string): string => {
  const s = t.replace(/\r$/, '').trim()
  return s.length > 46 ? `${s.slice(0, 45)}…` : s
}

interface Listed {
  rel: string
  lineNo: number
  above: string
  below: string
}

async function run(): Promise<void> {
  console.log(
    apply
      ? 'Mode : APPLY (rewriting notes, with backups)\n'
      : 'Mode : dry run (nothing will be written)\n'
  )
  if (!existsSync(notesRoot)) throw new Error(`No library at ${notesRoot}`)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(home, 'CentralCommand', 'backups', `tidy-paragraph-blanks-${stamp}`)
  let seen = 0
  let changed = 0
  let failed = 0
  let removedTotal = 0
  let singleTotal = 0
  const notesWithSingles = new Set<string>()
  const byFolder = new Map<string, number>()
  const kept = new Map<string, Listed[]>()
  const removedBy = new Map<string, number>()
  for (const path of markdownFiles(notesRoot).sort()) {
    const rel = relative(notesRoot, path)
    const note = await readNoteFile(path)
    const { head, body } = splitNote(note.content)
    seen++
    const plan = planParagraphBlanks(body)
    const headLines = head.split('\n').length - 1
    const raw = body.split('\n')
    const listed = (b: SingleBlank): Listed => ({
      rel,
      lineNo: headLines + b.line + 1,
      above: short(raw[b.line - 1]),
      below: short(raw[b.line + 1])
    })
    const all = [...plan.remove, ...plan.keep]
    singleTotal += all.length
    if (all.length > 0) notesWithSingles.add(rel)
    for (const b of plan.keep) {
      const label = pairLabel(b.above, b.below)
      kept.set(label, [...(kept.get(label) ?? []), listed(b)])
    }
    for (const b of plan.remove) {
      const label = pairLabel(b.above, b.below)
      removedBy.set(label, (removedBy.get(label) ?? 0) + 1)
    }
    if (plan.remove.length === 0) continue
    const tidy = dropLines(
      body,
      plan.remove.map((b) => b.line)
    )
    if (content(tidy).join('\n') !== content(body).join('\n')) {
      failed++
      console.log(`LEFT ALONE ${rel}: text other than blank lines would change`)
      continue
    }
    removedTotal += plan.remove.length
    const folder = dirname(rel)
    byFolder.set(folder, (byFolder.get(folder) ?? 0) + 1)
    console.log(
      `${rel}: ${plan.remove.length} blank line(s) removed (line ${plan.remove.map((b) => headLines + b.line + 1).join(', ')})`
    )
    if (!apply) {
      changed++
      continue
    }
    await mkdir(join(backupDir, dirname(rel)), { recursive: true })
    await writeFileAtomic(join(backupDir, rel), note.content)
    const { result, wrote } = await writeNoteFileGuarded(path, head + tidy, note.hash)
    if (result.status === 'conflict') {
      failed++
      console.log('  SKIPPED: the file changed while this ran; nothing was written to it.')
    } else if (wrote) changed++
  }
  console.log(
    `\n${changed} of ${seen} note(s) ${apply ? 'changed' : 'would change'}, ${removedTotal} blank line(s) removed${failed ? `, ${failed} left alone` : ''}.`
  )
  if (byFolder.size > 0) {
    console.log('\nBy folder:')
    for (const [folder, n] of [...byFolder].sort()) console.log(`  ${folder}: ${n}`)
  }
  const keptTotal = [...kept.values()].reduce((n, l) => n + l.length, 0)
  console.log(
    `\nAll single blank lines between two lines of text: ${singleTotal}, in ${notesWithSingles.size} note(s): ${removedTotal} removed, ${keptTotal} kept.`
  )
  console.log('Removed, by kind:')
  for (const [label, n] of [...removedBy].sort((a, b) => b[1] - a[1]))
    console.log(`  ${label}: ${n}`)
  console.log('Kept, by kind:')
  for (const [label, list] of [...kept].sort((a, b) => b[1].length - a[1].length))
    console.log(`  ${label}: ${list.length}`)
  for (const [label, list] of [...kept].sort((a, b) => b[1].length - a[1].length)) {
    console.log(
      `\nKept because the editor would read the joined lines differently, ${label} (${list.length}):`
    )
    for (const k of list) console.log(`  ${k.rel}:${k.lineNo}  "${k.above}" / "${k.below}"`)
  }
  if (apply && changed > 0) console.log(`Originals are in ${backupDir}`)
  if (!apply) console.log('\nDry run only. Re-run with --apply to rewrite these notes.')
}

void run()
