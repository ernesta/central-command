/**
 * Plain-text citations to reading entities (notes feedback round, stage 3, requested 2 Oct 2026):
 * "Kim et al. (2020)" becomes [Kim et al. (2020)](cc://reading/<citekey>). Rules: `src/shared/citations.ts`.
 *
 *   npm run link:citations                 # dry run: prints every proposed link, and what could not be linked
 *   npm run link:citations -- --apply      # rewrites the files (after copying each to a backup folder)
 *
 * Only a citation that fits exactly one reading (authors, their number, year) is linked. Ambiguous ones, ones that
 * match a reading only loosely (same first author and year, different authors), and ones with no reading are listed.
 * A rewrite is rejected unless removing the new links gives back the original text. Close the app before applying.
 */
import { mkdir } from 'fs/promises'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { homedir } from 'os'
import { join, relative } from 'path'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { writeFileAtomic } from '../src/main/atomic-write'
import { parseBib } from '../src/modules/readings/main/parse-bib'
import { applyCitations, proposeCitations, type Proposal } from '../src/shared/citations'

const apply = process.argv.includes('--apply')
const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const notesRoot = join(home, 'CentralCommand', 'notes')
const bibPath = join(home, 'CentralCommand', 'data', 'zotero-export.bib')

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('.')) return []
    const path = join(dir, name)
    return statSync(path).isDirectory() ? markdownFiles(path) : name.endsWith('.md') ? [path] : []
  })
}

const authorName = (a: { family: string } | { literal: string }): string =>
  'family' in a ? a.family : a.literal

function context(text: string, p: Proposal): string {
  const lineStart = text.lastIndexOf('\n', p.citation.start - 1) + 1
  const lineEnd = text.indexOf('\n', p.citation.end)
  const line = text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd)
  const at = p.citation.start - lineStart
  const from = Math.max(0, at - 50)
  return (
    (from > 0 ? '…' : '') +
    line.slice(from, at) +
    '⟦' +
    p.citation.text +
    '⟧' +
    line.slice(at + p.citation.text.length, at + p.citation.text.length + 50)
  )
}

async function run(): Promise<void> {
  console.log(
    apply ? 'Mode : APPLY (with backups)\n' : 'Mode : dry run (nothing will be written)\n'
  )
  if (!existsSync(notesRoot)) throw new Error(`No library at ${notesRoot}`)
  const readings = parseBib(readFileSync(bibPath, 'utf8')).map((r) => ({
    citekey: r.citekey,
    authors: r.authors.map(authorName),
    year: r.year
  }))
  console.log(`${readings.length} readings in the Zotero export.\n`)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(home, 'CentralCommand', 'backups', `link-citations-${stamp}`)
  const files = markdownFiles(notesRoot).sort()
  let changed = 0
  let links = 0
  let problems = 0
  const none = new Map<string, string[]>()
  const loose: string[] = []
  const ambiguous: string[] = []
  for (const path of files) {
    const rel = relative(notesRoot, path)
    const note = await readNoteFile(path)
    const own = rel.startsWith('readings/') ? rel.replace(/^readings\/|\.md$/g, '') : ''
    const proposals = proposeCitations(note.content, readings).filter(
      (p) => !(p.resolution.kind === 'linked' && p.resolution.citekey === own)
    )
    const linked = proposals.filter((p) => p.resolution.kind === 'linked')
    for (const p of proposals) {
      const where = `${rel}: ${context(note.content, p)}`
      if (p.resolution.kind === 'none')
        none.set(p.citation.text, [...(none.get(p.citation.text) ?? []), rel])
      else if (p.resolution.kind === 'loose')
        loose.push(`${where}\n      readings: ${p.resolution.citekeys.join(', ')}`)
      else if (p.resolution.kind === 'ambiguous')
        ambiguous.push(`${where}\n      candidates: ${p.resolution.citekeys.join(', ')}`)
    }
    if (linked.length === 0) continue
    console.log(rel)
    for (const p of linked)
      console.log(
        `    ${context(note.content, p)}\n      -> ${(p.resolution as { citekey: string }).citekey}`
      )
    const next = applyCitations(note.content, proposals)
    const undone = next.replace(
      /\[((?:\\.|[^\]\\\n])*)\]\(cc:\/\/reading\/[^\s()]+\)/g,
      (m, label: string) =>
        note.content.includes(label.replace(/\\([[\]\\])/g, '$1'))
          ? label.replace(/\\([[\]\\])/g, '$1')
          : m
    )
    if (undone !== note.content || next.split('\n').length !== note.content.split('\n').length) {
      problems++
      console.log('  LEFT ALONE: removing the new links does not give back the original.')
      continue
    }
    links += linked.length
    if (!apply) {
      changed++
      continue
    }
    await mkdir(join(backupDir, relative(notesRoot, join(path, '..'))), { recursive: true })
    await writeFileAtomic(join(backupDir, rel), note.content)
    const { result, wrote } = await writeNoteFileGuarded(path, next, note.hash)
    if (result.status === 'conflict') {
      problems++
      console.log('  SKIPPED: the file changed while this ran.')
    } else if (wrote) changed++
  }
  console.log(`\n=== AMBIGUOUS (${ambiguous.length}), not linked ===`)
  ambiguous.forEach((l) => console.log(`  ${l}`))
  console.log(
    `\n=== LOOSE (${loose.length}): same first author and year, authors differ, not linked ===`
  )
  loose.forEach((l) => console.log(`  ${l}`))
  console.log(`\n=== NO READING YET (${none.size} different citations) ===`)
  for (const [text, where] of [...none].sort())
    console.log(`  ${text}   (${[...new Set(where)].join('; ')})`)
  console.log(
    `\n${links} link(s) in ${changed} file(s) ${apply ? 'written' : 'proposed'}, ${problems} left alone.`
  )
  if (apply && changed > 0) console.log(`Originals are in ${backupDir}`)
  if (!apply) console.log('Dry run only. Re-run with --apply to rewrite these files.')
}

void run()
