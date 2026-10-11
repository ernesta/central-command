/**
 * People named in prose to person entities (requested 11 Oct 2026): "Reach out to Matthew Jukes" becomes
 * "Reach out to [Matthew Jukes](cc://person/Matthew%20Jukes)". Rules: `src/shared/people-mentions.ts`.
 *
 *   npm run link:people                 # dry run: prints every proposed link
 *   npm run link:people -- --apply      # rewrites the files (after copying each to a backup folder)
 *
 * Full names are linked, and so is a first name that exactly one person in `people.json` has ("Kathy" ->
 * Kathy Rastle), keeping the first name as the label. A first name two people share ("Caitlin", "Chris") is never
 * guessed: it is listed for the user to map by hand. A first name is also skipped where a longer name follows it
 * ("Thomas Henry Huxley") or where it reads as a citation ("Collier and Thomas (2017)").
 *
 * Three rules from the user (11 Oct 2026; `src/shared/people-mentions.ts`): never the user themselves, never someone
 * the note says was in the meeting, and only the first mention of a person per note. The pass is **authoritative**: it
 * both adds the chips the rules call for and takes away ones that break them, so running it twice changes nothing.
 * Every skip and every removal is printed with its reason. `--first-names-off` links full names only.
 *
 * Front matter, headings, code, URLs and text that is already a link are never touched, and neither is any other kind
 * of entity chip. A rewrite is rejected unless un-chipping the result gives back exactly the un-chipped original, so
 * only chips can ever move. Close the app before applying.
 */
import { mkdir } from 'fs/promises'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { homedir } from 'os'
import { join, relative } from 'path'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { writeFileAtomic } from '../src/main/atomic-write'
import { isProtected, protectedRanges } from '../src/shared/note-text'
import { splitNote } from '../src/shared/front-matter'
import {
  aliasesFor,
  firstNameAliases,
  fullNameAliases,
  peoplePresent,
  planPersonChips,
  unchipPersonMentions,
  type AliasEntry,
  type PersonAlias
} from '../src/shared/people-mentions'

const apply = process.argv.includes('--apply')
const firstNamesOff = process.argv.includes('--first-names-off')
const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const notesRoot = join(home, 'CentralCommand', 'notes')
const peoplePath = join(home, 'CentralCommand', 'data', 'people.json')
// The user's own decisions about spellings the rules cannot resolve. Their data, so it lives in their library.
const aliasPath = join(home, 'CentralCommand', 'data', 'people-aliases.json')

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('.')) return []
    const path = join(dir, name)
    return statSync(path).isDirectory() ? markdownFiles(path) : name.endsWith('.md') ? [path] : []
  })
}

/** The labels of the person chips in some text, for counting what the result holds. */
function findChips(text: string): string[] {
  return [...text.matchAll(/\[([^\]\n]*)\]\(cc:\/\/person\/[^)\n]*\)/g)].map((m) => m[1])
}

/** The whole line the name sits in, with the name marked, so each proposal can be read in context. */
function context(text: string, start: number, length: number): string {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  const lineEnd = text.indexOf('\n', start + length)
  const line = text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd)
  const at = start - lineStart
  const from = Math.max(0, at - 60)
  return (
    (from > 0 ? '…' : '') +
    line.slice(from, at) +
    '⟦' +
    line.slice(at, at + length) +
    '⟧' +
    line.slice(at + length, at + length + 60)
  )
}

async function run(): Promise<void> {
  console.log(
    apply ? 'Mode : APPLY (with backups)\n' : 'Mode : dry run (nothing will be written)\n'
  )
  if (!existsSync(notesRoot)) throw new Error(`No library at ${notesRoot}`)
  const parsed: unknown = JSON.parse(readFileSync(peoplePath, 'utf8'))
  const list = (
    Array.isArray(parsed) ? parsed : ((parsed as { people?: unknown[] }).people ?? [])
  ) as Array<{ name?: string; me?: boolean }>
  const names = list.map((p) => p.name).filter((n): n is string => !!n && n.trim().length > 0)
  // Rule 1: the person the people list flags as the user. Nothing is hardcoded.
  const me = list.find((p) => p.me === true)?.name ?? ''
  if (names.length === 0) throw new Error(`No people in ${peoplePath}`)
  let decided: AliasEntry[] = []
  if (existsSync(aliasPath)) {
    const read: unknown = JSON.parse(readFileSync(aliasPath, 'utf8'))
    const raw = (
      Array.isArray(read) ? read : ((read as { aliases?: unknown[] }).aliases ?? [])
    ) as AliasEntry[]
    decided = raw.filter((e) => e.text && e.person)
    const unknown = decided.filter((e) => !names.includes(e.person))
    if (unknown.length)
      throw new Error(
        `people-aliases.json names someone not in the people list: ${unknown.map((e) => e.person).join(', ')}`
      )
  }
  const full = fullNameAliases(names)
  const { aliases: firsts, ambiguous } = firstNameAliases(names)
  const aliases: PersonAlias[] = firstNamesOff ? full : [...full, ...firsts]
  console.log(
    `${names.length} people in the people list; ${aliases.length} spellings to look for ` +
      `(${full.length} full names${firstNamesOff ? ', first names off' : `, ${firsts.length} first names`}).`
  )
  console.log(
    me
      ? `Never linked: ${me} (you), and whoever each note says was there.`
      : 'No "me" in the people list.'
  )
  console.log(
    decided.length
      ? `${decided.length} decided spelling(s) from people-aliases.json: ` +
          `${decided.map((e) => `"${e.text}" -> ${e.person}`).join('; ')}\n`
      : 'No people-aliases.json, so nothing is resolved by hand.\n'
  )
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(home, 'CentralCommand', 'backups', `link-people-${stamp}`)
  const files = markdownFiles(notesRoot).sort()
  let changed = 0
  let links = 0
  let problems = 0
  const perPerson = new Map<string, number>()
  const perLabel = new Map<string, number>()
  const skippedAll: string[] = []
  const ambiguousHits = new Map<string, string[]>()
  let removedTotal = 0
  for (const path of files) {
    const rel = relative(notesRoot, path)
    const note = await readNoteFile(path)
    const present = peoplePresent(splitNote(note.content).head)
    const skip = new Set([...(me ? [me] : []), ...present])
    // A decided spelling is tried before the generic ones, and only where the user said it holds.
    const forNote: PersonAlias[] = [...aliasesFor(decided, rel), ...aliases]
    const plan = planPersonChips(note.content, forNote, { skip, me, firstMentionOnly: true })
    for (const sk of plan.skipped)
      skippedAll.push(
        `${rel}: ${context(note.content, sk.start, sk.text.length)}\n      ${sk.reason}`
      )
    if (plan.next === note.content) {
      for (const m of findChips(note.content)) perPerson.set(m, (perPerson.get(m) ?? 0) + 1)
      continue
    }
    console.log(rel)
    if (present.length) console.log(`    (in the meeting: ${present.join(', ')})`)
    for (const r of plan.removed) console.log(`    - [${r.label}] -> ${r.name}  (${r.reason})`)
    for (const m of findChips(plan.next)) {
      perPerson.set(m, (perPerson.get(m) ?? 0) + 1)
      perLabel.set(m, (perLabel.get(m) ?? 0) + 1)
    }
    const lines = (s: string): number => s.split('\n').length
    if (
      unchipPersonMentions(plan.next) !== unchipPersonMentions(note.content) ||
      lines(plan.next) !== lines(note.content)
    ) {
      problems++
      console.log('  LEFT ALONE: the rewrite moves more than chips.')
      continue
    }
    const next = plan.next
    links += plan.added
    removedTotal += plan.removed.length
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
  // Where an ambiguous first name actually appears in prose, so the user can map it. Uses the same protected ranges
  // as the pass itself, so a `leads: [Chris Prosser]` front-matter field is not reported as something to decide.
  for (const path of files) {
    const text = readFileSync(path, 'utf8')
    const ranges = protectedRanges(text)
    for (const [first, people] of ambiguous) {
      // Not something to map if the user has already decided this spelling for this note.
      const settled = aliasesFor(decided, relative(notesRoot, path)).some(
        (a) => a.text === first || a.text.startsWith(`${first} `) || a.text.startsWith(`${first}.`)
      )
      if (settled) continue
      const re = new RegExp(`(?<![\\p{L}\\p{N}'\u2019-])${first}(?![\\p{L}\\p{N}-])`, 'gu')
      const hits = [...text.matchAll(re)].filter(
        (m) => !isProtected(ranges, m.index, m.index + first.length)
      )
      if (hits.length === 0) continue
      ambiguousHits.set(first, [
        ...(ambiguousHits.get(first) ?? []),
        ...hits.map(
          (m) =>
            `${relative(notesRoot, path)}: ${context(text, m.index, first.length)}` +
            `\n          one of: ${people.join(', ')}`
        )
      ])
    }
  }
  console.log(`\n=== SKIPPED, with the reason (${skippedAll.length}) ===`)
  skippedAll.forEach((l) => console.log(`  ${l}`))
  const toMap = [...ambiguousHits.values()].reduce((n, w) => n + w.length, 0)
  console.log(`\n=== FIRST NAMES TWO PEOPLE SHARE: for the user to map (${toMap}) ===`)
  for (const [first, where] of [...ambiguousHits].sort()) {
    console.log(`  "${first}" (${where.length}):`)
    where.forEach((w) => console.log(`      ${w}`))
  }
  console.log(`\n=== CHIPS AFTER THIS RUN, BY LABEL ===`)
  for (const [label, count] of [...perLabel].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  ))
    console.log(`  ${String(count).padStart(3)}  ${label}`)
  console.log(`\n=== CHIPS AFTER THIS RUN, BY PERSON ===`)
  for (const [name, count] of [...perPerson].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  ))
    console.log(`  ${String(count).padStart(3)}  ${name}`)
  console.log(
    `\n${links} chip(s) added and ${removedTotal} taken away, in ${changed} file(s) ` +
      `${apply ? 'written' : 'proposed'}, ${problems} left alone.`
  )
  if (apply && changed > 0) console.log(`Originals are in ${backupDir}`)
  if (!apply) console.log('Dry run only. Re-run with --apply to rewrite these files.')
}

void run()
