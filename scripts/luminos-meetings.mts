/**
 * One-off (26 Oct 2026, the user's request): the 14 Impact meetings of the oldest Work contract (Luminos, 1 Oct 2025 – 31 Mar 2026).
 * Each gets its times and Online format, its topics as `###` headings and ticked, TODO full stops removed, a meeting task of its own
 * under one "Impact meetings" series task, and the meeting's minutes moved onto it from the broader task the note named before
 * (renamed "Meeting preparation and follow-up"). The contract's total hours must not change; the script says so, or refuses.
 *
 *   npm run luminos:meetings               # dry run: a throwaway copy of the database; proposed notes go to --out
 *   npm run luminos:meetings -- --apply    # app closed; backs up the notes, the database and the contract file first
 *
 * Options: --out <dir> (dry run: where the proposed notes are written), --shortfall-from <uid>[:<date>] (not used yet).
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { openDatabase } from '../src/main/db/connection'
import { runMigrations } from '../src/main/db/migrate'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { readNoteFile, writeNoteFileGuarded } from '../src/main/notes/guarded-file'
import { tasksMigrationsFromDir } from '../src/modules/tasks/main/import/migration-files'
import { TasksStore } from '../src/modules/tasks/main/tasks-store'
import { applyChanges, splitNote } from '../src/modules/meetings/shared/front-matter'
import { convertPseudoHeadings } from '../src/modules/meetings/shared/pseudo-headings'
import { parseTopics } from '../src/modules/meetings/shared/topics'
import { meetingTaskTitle } from '../src/modules/meetings/shared/meeting-task'
import { durationMinutes } from '../src/modules/meetings/shared/time'

const apply = process.argv.includes('--apply')
const outArg = process.argv.indexOf('--out')
const outDir = outArg >= 0 ? process.argv[outArg + 1] : undefined
const root = join(
  assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir()),
  'CentralCommand'
)
const databaseFile = join(root, 'data', 'central-command.sqlite')
const notesDir = join(root, 'notes', 'meetings', 'work')
const contractFile = join(root, 'time', 'work', '2025-10-01.json')

const SERIES_TITLE = 'Impact meetings'
const SERIES_LIST = 'Impact'
const BROADER_TITLE = 'Meeting preparation and follow-up'

/** The user's answers: file, start, end, and the task the note named. */
const MEETINGS: { file: string; start: string; end: string; task: string }[] = [
  { file: '2025-10-06 Impact.md', start: '11:00', end: '11:45', task: 'jjfe8nag' },
  { file: '2025-10-20 Impact.md', start: '12:00', end: '12:45', task: '7n42rh57' },
  { file: '2025-11-03 Impact.md', start: '11:00', end: '11:45', task: 'z29safyy' },
  { file: '2025-11-04 Impact.md', start: '09:00', end: '10:00', task: 'usywwqtp' },
  { file: '2025-11-04 Impact 2.md', start: '11:00', end: '12:00', task: 'xpn83hpy' },
  { file: '2025-11-17 Impact.md', start: '11:00', end: '11:45', task: 'cmhp63nf' },
  { file: '2025-12-01 Impact.md', start: '10:30', end: '11:15', task: 'qxdh9qc3' },
  { file: '2025-12-19 Impact.md', start: '12:00', end: '12:45', task: 'fxee22u7' },
  { file: '2026-01-19 Impact.md', start: '14:00', end: '14:45', task: '2k7w2vzb' },
  { file: '2026-02-02 Impact.md', start: '10:30', end: '11:15', task: 'keaafgsg' },
  { file: '2026-02-09 Impact.md', start: '10:00', end: '11:00', task: 'mpyp4bdb' },
  { file: '2026-02-19 Impact.md', start: '14:00', end: '15:00', task: 'kj9fetxc' },
  { file: '2026-03-09 Impact.md', start: '10:00', end: '11:00', task: 'fjjnc2q9' },
  { file: '2026-03-12 Impact.md', start: '13:30', end: '14:45', task: 'wdpbrwg8' }
]

/** A bullet that is only a topic: top-level `- Title`, not a checkbox and not a TODO. */
const TOP_BULLET = /^- (?!\[[ xX]\])(?!\*\*TODO)(.+?)\s*$/

/**
 * Top-level bullets under `## Notes` become `### Title`, their sub-points move up one level. Only for a note with no `###` topic
 * yet and more than one top-level topic bullet pattern that has sub-points. `eol` is the note's own line break.
 */
function bulletsToHeadings(body: string): { body: string; converted: number } {
  const eol = body.includes('\r\n') ? '\r\n' : '\n'
  const lines = body.split(/\r?\n/)
  const notes = lines.findIndex((l) => /^## Notes\s*$/.test(l))
  if (notes < 0 || lines.some((l) => /^### /.test(l))) return { body, converted: 0 }
  const out = lines.slice(0, notes + 1)
  let converted = 0
  let inTopic = false
  for (const line of lines.slice(notes + 1)) {
    const m = TOP_BULLET.exec(line)
    if (m) {
      out.push(`### ${m[1]}`)
      inTopic = true
      converted++
    } else if (inTopic && /^ {2}/.test(line)) {
      out.push(line.slice(2))
    } else {
      out.push(line)
      if (line.trim() !== '' && !/^#/.test(line)) inTopic = false
    }
  }
  return { body: out.join(eol), converted }
}

/** Strip one trailing full stop from a TODO checkbox line (not an ellipsis). */
function stripTodoStops(body: string): { body: string; stripped: number } {
  let stripped = 0
  const out = body.replace(/^(\s*- \[[ xX]\] .*[^.\s])\.[ \t]*(\r?)$/gm, (_m, a, cr) => {
    stripped++
    return a + cr
  })
  return { body: out, stripped }
}

/** Every line's words with list and heading markers removed: a conversion changes only markers and indents. */
const skeleton = (body: string): string =>
  body
    .split(/\r?\n/)
    .map((l) =>
      l
        .trim()
        .replace(/^(?:- |#{1,6} )/, '')
        .replace(/\.$/, '')
        .replace(/^\*\*(.*)\*\*$/, '$1')
        .trim()
    )
    .filter((l) => l !== '')
    .join('\n')

interface Prepared {
  spec: (typeof MEETINGS)[number]
  date: string
  minutes: number
  original: string
  hash: string
  body: string
  topics: string[]
  notes: string[]
}

async function prepare(): Promise<Prepared[]> {
  const result: Prepared[] = []
  for (const spec of MEETINGS) {
    const p0 = spec
    const note = await readNoteFile(join(notesDir, spec.file))
    if (!note.exists) throw new Error(`Missing note ${spec.file}`)
    const { head, body } = splitNote(note.content)
    const date = /^date:\s*['"]?(\d{4}-\d{2}-\d{2})/m.exec(head)?.[1]
    if (!date || !spec.file.startsWith(date)) throw new Error(`${spec.file}: date not found`)
    const minutes = durationMinutes(spec.start, spec.end)
    if (minutes === null) throw new Error(`${spec.file}: bad times`)
    const notes: string[] = []
    const pseudo = convertPseudoHeadings(body)
    if (pseudo.converted.length) notes.push(`${pseudo.converted.length} bold title(s) to headings`)
    let next = pseudo.body
    // 12 Mar's bullets are decisions under its one `## Topic`, not topics.
    const bullets =
      p0.file === '2026-03-12 Impact.md' ? { body: next, converted: 0 } : bulletsToHeadings(next)
    if (bullets.converted) notes.push(`${bullets.converted} top-level bullet(s) to headings`)
    next = bullets.body
    const stops = stripTodoStops(next)
    if (stops.stripped) notes.push(`${stops.stripped} TODO full stop(s) removed`)
    next = stops.body
    if (skeleton(next) !== skeleton(body)) throw new Error(`${spec.file}: conversion changed text`)
    const topics = parseTopics(next).map((t) => t.text)
    result.push({
      spec,
      date,
      minutes,
      original: note.content,
      hash: note.hash,
      body: next,
      topics,
      notes
    })
  }
  return result
}

const migrations = tasksMigrationsFromDir(join(process.cwd(), 'src/modules/tasks/main/migrations'))

interface Adjust {
  id: string
  date: string
  minutes: number
  task?: string
  [key: string]: unknown
}

async function main(): Promise<void> {
  if (!existsSync(databaseFile)) throw new Error(`No library under ${root}`)
  const prepared = await prepare()
  console.log(apply ? 'Mode: APPLY\n' : 'Mode: dry run (nothing in the library is written)\n')

  // --- the contract file: move the minutes -------------------------------------------------
  const contract = JSON.parse(readFileSync(contractFile, 'utf8')) as { adjusts: Adjust[] }
  const sum = (): number => contract.adjusts.reduce((n, a) => n + a.minutes, 0)
  const before = sum()
  const moved = prepared.reduce((n, p) => n + p.minutes, 0)
  const shortfalls: string[] = []
  const removeEarlier = new Map<string, number>()
  for (const p of prepared) {
    const task = `cc://task/${p.spec.task}`
    const row = contract.adjusts.find((a) => a.task === task && a.date === p.date)
    const have = row?.minutes ?? 0
    const take = Math.min(have, p.minutes)
    if (take < p.minutes)
      shortfalls.push(
        `${p.spec.file}: the meeting is ${p.minutes} min, the task has ${have} on ${p.date}`
      )
    if (row) {
      row.minutes -= take
      if (row.minutes === 0) contract.adjusts.splice(contract.adjusts.indexOf(row), 1)
    }
    removeEarlier.set(p.spec.task, take)
  }
  // 3 Nov's meeting is 15 min longer than its task's time that day: the user's answer (26 Oct 2026) is to take it from what
  // 4 Nov's 09:00 meeting's broader task keeps.
  const extra = contract.adjusts.find(
    (x) => x.task === 'cc://task/usywwqtp' && x.date === '2025-11-04'
  )
  if (extra && shortfalls.length === 1) {
    extra.minutes -= 15
    removeEarlier.set('usywwqtp', (removeEarlier.get('usywwqtp') ?? 0) + 15)
    shortfalls.length = 0
    console.log('3 Nov: 15 min taken from the 4 Nov 09:00 meeting task.\n')
  }
  const after = sum() + moved
  for (const p of prepared) {
    console.log(
      `${p.spec.file}  ${p.spec.start}–${p.spec.end} (${p.minutes} min)  topics: ${p.topics.length} [${p.topics.join(' | ')}]` +
        (p.notes.length ? `\n    ${p.notes.join('; ')}` : '')
    )
  }
  console.log(
    `\nContract hours: ${before} min before; ${after} min after (adjusts ${sum()} + meetings ${moved}).`
  )
  if (shortfalls.length) {
    console.log('Shortfalls (the contract would grow):')
    for (const s of shortfalls) console.log(`  ${s}`)
  }
  if (after !== before) {
    console.log('\nRefusing: the contract total would change.')
    if (!outDir) process.exitCode = 1
  }

  // --- the database, on a throwaway copy unless applying ----------------------------------
  const scratch = mkdtempSync(join(tmpdir(), 'cc-luminos-'))
  const copyFile = join(scratch, 'copy.sqlite')
  let dbFile = databaseFile
  if (!apply) {
    const reader = new Database(databaseFile, { readonly: true })
    reader.prepare('VACUUM INTO ?').run(copyFile)
    reader.close()
    dbFile = copyFile
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backups = join(root, 'backups', `luminos-meetings-${stamp}`)
  if (apply) {
    if (after !== before) throw new Error('The contract total would change; nothing written.')
    mkdirSync(join(backups, 'notes'), { recursive: true })
    cpSync(databaseFile, join(backups, 'central-command.sqlite'))
    cpSync(contractFile, join(backups, '2025-10-01.json'))
  }
  const db = openDatabase(dbFile)
  const uids = new Map<string, string>()
  try {
    runMigrations(db, migrations)
    const store = new TasksStore(db)
    db.transaction(() => {
      const series = store.create({ workspace: 'work', title: SERIES_TITLE, list: SERIES_LIST })
      for (const p of prepared) {
        const child = store.create({
          workspace: 'work',
          title: meetingTaskTitle(SERIES_TITLE, p.date),
          parentUid: series.uid,
          due: p.date,
          status: 'done',
          ownKind: 'meeting'
        })
        uids.set(p.spec.file, child.uid)
        const old = store.get(p.spec.task)
        if (!old) throw new Error(`Task ${p.spec.task} is gone`)
        store.update(p.spec.task, { title: BROADER_TITLE })
        const take = removeEarlier.get(p.spec.task) ?? 0
        db.prepare(
          'UPDATE tasks SET earlier_minutes = MAX(0, earlier_minutes - ?) WHERE uid = ?'
        ).run(take, p.spec.task)
      }
      store.settleSeries(series.uid)
    })()
    const s = db
      .prepare('SELECT title, status, due FROM tasks WHERE title = ? AND parent_uid IS NULL')
      .get(SERIES_TITLE) as { title: string; status: string; due: string }
    console.log(
      `\nSeries task "${s.title}": ${s.status}, due ${s.due}; ${uids.size} meeting tasks.`
    )
  } finally {
    db.close()
  }

  // --- the notes ---------------------------------------------------------------------------
  for (const p of prepared) {
    const uid = uids.get(p.spec.file) as string
    const text = applyChanges(p.original, {
      meta: {
        start: p.spec.start,
        end: p.spec.end,
        mode: 'online',
        discussed: p.topics,
        task: uid
      },
      body: p.body
    })
    if (!apply) {
      if (outDir) {
        mkdirSync(outDir, { recursive: true })
        writeFileSync(join(outDir, p.spec.file), text)
      }
      continue
    }
    writeFileSync(join(backups, 'notes', p.spec.file), p.original)
    const { result } = await writeNoteFileGuarded(join(notesDir, p.spec.file), text, p.hash)
    if (result.status === 'conflict') throw new Error(`${p.spec.file} changed while this ran`)
  }
  if (apply) {
    writeFileSync(contractFile, JSON.stringify(contract, null, 2) + '\n')
    console.log(`\nDone. Backups: ${backups}`)
  } else {
    console.log('\nDry run: nothing changed.')
  }
  rmSync(scratch, { recursive: true, force: true })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
