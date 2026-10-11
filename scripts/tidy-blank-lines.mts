/**
 * One-off tidy (11 Oct 2026, `docs/BLANK_LINES_PLAN.md`): take out the blank lines that imported notes still show, in
 * every note folder including `readings/`: at the very start of the body, around headings, and after the last line
 * of text (the body ends with exactly one line break). Notes have no blank line there since 2 Oct 2026; the editor
 * draws the space itself.
 *
 *   npm run tidy:blank-lines                # dry run: lists the notes it would change, writes nothing
 *   npm run tidy:blank-lines -- --apply     # rewrites them (after copying each to a backup folder)
 *
 * Only blank lines go (empty or whitespace only). Blank lines between paragraphs, lists and tables, inside code
 * fences, and the front matter stay as they are. Each result is checked (every non-blank line identical, in order)
 * and a note that fails is left alone and reported. Readings notes are included: this removes only blank lines,
 * backs each file up first and writes through the content-hash guard, the same as a save in the app. Applying copies
 * every note it changes to `~/CentralCommand/backups/tidy-blank-lines-<time>/` first; a note that changed since it
 * was read is skipped. Close the app before applying. A second run after `--apply` finds nothing.
 *
 * The summary also counts the notes whose body ends with exactly one line break and would change in no other way:
 * that last line break is drawn by the editor as an empty last line, which this script does not remove.
 */
import { mkdir } from 'fs/promises'
import { existsSync, readdirSync, statSync } from 'fs'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { homedir } from 'os'
import { dirname, join, relative } from 'path'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { writeFileAtomic } from '../src/main/atomic-write'
import { splitNote } from '../src/shared/front-matter'
import { tidyBlankLines, tightenHeadings } from '../src/shared/heading-spacing'

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

/** Blank lines in a body; what follows the final line break is not a line. */
function blankLines(t: string): number {
  const lines = t.split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines.filter((l) => l.trim() === '').length
}

/** Blank lines at the start of a body. */
function leadingBlanks(t: string): number {
  let n = 0
  for (const l of t.split('\n')) {
    if (l.trim() !== '') break
    n++
  }
  return n
}

async function run(): Promise<void> {
  console.log(
    apply
      ? 'Mode : APPLY (rewriting notes, with backups)\n'
      : 'Mode : dry run (nothing will be written)\n'
  )
  if (!existsSync(notesRoot)) throw new Error(`No library at ${notesRoot}`)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(home, 'CentralCommand', 'backups', `tidy-blank-lines-${stamp}`)
  let seen = 0
  let changed = 0
  let failed = 0
  let blanks = 0
  let oneBreakOnly = 0
  const totals = { start: 0, headings: 0, end: 0 }
  const byFolder = new Map<string, number>()
  for (const path of markdownFiles(notesRoot).sort()) {
    const rel = relative(notesRoot, path)
    const note = await readNoteFile(path)
    const { head, body } = splitNote(note.content)
    seen++
    const tidy = tidyBlankLines(body)
    if (tidy === body) {
      if (/[^\r\n]\r?\n$/.test(body)) oneBreakOnly++
      continue
    }
    if (content(tidy).join('\n') !== content(body).join('\n')) {
      failed++
      console.log(`LEFT ALONE ${rel}: text other than blank lines would change`)
      continue
    }
    const tight = tightenHeadings(body)
    const start = leadingBlanks(tight)
    const headings = blankLines(body) - blankLines(tight)
    const removed = blankLines(body) - blankLines(tidy)
    // Whitespace on a last line without a line break is not a blank line to count, but it goes.
    const end = Math.max(0, removed - headings - start)
    blanks += removed
    totals.start += start
    totals.headings += headings
    totals.end += end
    const folder = dirname(rel)
    byFolder.set(folder, (byFolder.get(folder) ?? 0) + 1)
    const where = [
      start ? `${start} at the start` : '',
      headings ? `${headings} around headings` : '',
      end ? `${end} at the end` : ''
    ].filter(Boolean)
    console.log(
      `${rel}: ${removed} blank line(s) removed${where.length ? ` (${where.join(', ')})` : ''}`
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
    `\n${changed} of ${seen} note(s) ${apply ? 'changed' : 'would change'}, ${blanks} blank line(s) (${totals.start} at the start, ${totals.headings} around headings, ${totals.end} at the end)${failed ? `, ${failed} left alone` : ''}.`
  )
  if (byFolder.size > 0) {
    console.log('\nBy folder:')
    for (const [folder, n] of [...byFolder].sort()) console.log(`  ${folder}: ${n}`)
  }
  console.log(
    `\n${oneBreakOnly} note(s) end with exactly one line break and would change in no other way (the editor draws that break as an empty last line).`
  )
  if (apply && changed > 0) console.log(`Originals are in ${backupDir}`)
  if (!apply) console.log('Dry run only. Re-run with --apply to rewrite these notes.')
}

void run()
