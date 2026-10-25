/**
 * One-off (25 Oct 2026, the user's request): the 8 meetings of the second Work contract (Luminos, 1 May – 31 Oct 2026), a copy of
 * `luminos-meetings.mts` (the first contract's, applied; do not re-run it). Each gets its times (five are new, three are already in
 * the note) and Online format, its topics ticked (`###` headings first where they were bold lines or top-level bullets), TODO full
 * stops removed, a meeting task of its own under a NEW series task per note series (never a reopened one), and the meeting's minutes
 * moved onto it from the broader task the note named before (renamed "Meeting preparation and follow-up"). The contract's total
 * hours must not change; the script says so, or refuses.
 *
 *   npm run luminos:meetings-2               # dry run: a throwaway copy of the database; proposed notes go to --out
 *   npm run luminos:meetings-2 -- --apply    # app closed; backs up the notes, the database and the contract file first
 *
 * Options: --out <dir> (dry run: where the proposed notes are written).
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
const contractName = '2026-05-01.json'
const contractFile = join(root, 'time', 'work', contractName)

/** A series task: new for this contract, named and placed by the app's rule, the user's answers of 25 Oct 2026. */
const SERIES = {
  impact: { title: 'Impact meetings', list: 'Impact', sublist: 'Admin & Logistics' },
  luminos: {
    title: 'Document Automation – Luminos meetings',
    list: 'Teaching & Learning',
    sublist: ''
  },
  vecten: {
    title: 'Document Automation – Vecten meetings',
    list: 'Teaching & Learning',
    sublist: ''
  },
  other: { title: 'Document Automation – Other meetings', list: 'Teaching & Learning', sublist: '' }
} as const
const BROADER_TITLE = 'Meeting preparation and follow-up'
/** The one broader task that keeps a name of its own (the user's, 25 Oct 2026): it holds the prep of two interviews. */
const BROADER_TITLES: Record<string, string> = {
  bvq7fmsz: 'Document automation: developer interview follow-ups'
}

/**
 * The rule that every series task is "<series> meetings" (commit abb0409) renames Research's three existing series tasks, and the
 * titles of their meeting subtasks with them (the app would do it note by note otherwise). `from` is checked first.
 */
const RESEARCH_RENAMES = [
  { uid: 'qm62wq93', from: 'Meetings', to: 'Other meetings' },
  { uid: 'vr9r5wgj', from: 'Rastle Lab', to: 'Rastle Lab meetings' },
  { uid: 'zwtfwe33', from: 'Supervision', to: 'Supervision meetings' }
]

/**
 * The user's answers: file, series, the task the note named, and start and end (none: the note already has them). `adjust` names
 * the adjust the minutes come from when the task has more than one that day.
 */
const MEETINGS: {
  file: string
  series: keyof typeof SERIES
  task: string
  start?: string
  end?: string
  adjust?: string
}[] = [
  {
    file: '2026-05-21 Impact.md',
    series: 'impact',
    task: 'rwfwwcc5',
    start: '11:00',
    end: '12:00'
  },
  {
    file: '2026-06-04 Impact.md',
    series: 'impact',
    task: 'acfaeq6u',
    start: '11:00',
    end: '11:45'
  },
  {
    file: '2026-06-18 Impact.md',
    series: 'impact',
    task: 's7axckr5',
    start: '12:30',
    end: '13:00'
  },
  {
    file: '2026-07-03 Document Automation – Luminos.md',
    series: 'luminos',
    task: 'wwxewwph',
    start: '10:00',
    end: '11:00',
    adjust: 'import-042'
  },
  {
    file: '2026-07-09 Impact.md',
    series: 'impact',
    task: '28e2q46f',
    start: '11:00',
    end: '11:30'
  },
  { file: '2026-09-29 Document Automation – Vecten.md', series: 'vecten', task: 'bvq7fmsz' },
  { file: '2026-09-30 Document Automation – Other.md', series: 'other', task: 'bvq7fmsz' },
  { file: '2026-10-05 Document Automation – Luminos.md', series: 'luminos', task: 'hwugqgc4' }
]

/** A bullet that is only a topic: top-level `- Title`, not a checkbox and not a TODO. */
const TOP_BULLET = /^- (?!\[[ xX]\])(?!\*\*TODO)(.+?)\s*$/

/**
 * Top-level bullets under `## Notes` become `### Title`, their sub-points move up one level. Only for a note with a `## Notes`
 * and no `###` topic yet. `eol` is the note's own line break.
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
  start: string
  end: string
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
    const note = await readNoteFile(join(notesDir, spec.file))
    if (!note.exists) throw new Error(`Missing note ${spec.file}`)
    const { head, body } = splitNote(note.content)
    const date = /^date:\s*['"]?(\d{4}-\d{2}-\d{2})/m.exec(head)?.[1]
    if (!date || !spec.file.startsWith(date)) throw new Error(`${spec.file}: date not found`)
    const own = {
      start: /^start:\s*['"]?(\d{2}:\d{2})/m.exec(head)?.[1],
      end: /^end:\s*['"]?(\d{2}:\d{2})/m.exec(head)?.[1]
    }
    const notes: string[] = []
    // A note that already has both times keeps them: the user's answer was not asked for it.
    if (own.start && own.end) {
      if (spec.start || spec.end) throw new Error(`${spec.file}: already has times, none expected`)
      notes.push('times already in the note')
    } else if (!spec.start || !spec.end) throw new Error(`${spec.file}: no times given`)
    const start = (own.start && own.end ? own.start : spec.start) as string
    const end = (own.start && own.end ? own.end : spec.end) as string
    const minutes = durationMinutes(start, end)
    if (minutes === null || minutes <= 0) throw new Error(`${spec.file}: bad times`)
    const pseudo = convertPseudoHeadings(body)
    if (pseudo.converted.length) notes.push(`${pseudo.converted.length} bold title(s) to headings`)
    let next = pseudo.body
    const bullets = bulletsToHeadings(next)
    if (bullets.converted) notes.push(`${bullets.converted} top-level bullet(s) to headings`)
    next = bullets.body
    const stops = stripTodoStops(next)
    if (stops.stripped) notes.push(`${stops.stripped} TODO full stop(s) removed`)
    next = stops.body
    if (skeleton(next) !== skeleton(body)) throw new Error(`${spec.file}: conversion changed text`)
    const topics = parseTopics(next).map((t) => t.text)
    if (topics.length === 0) throw new Error(`${spec.file}: no topics found`)
    result.push({
      spec,
      date,
      start,
      end,
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
  const taken = new Map<string, number>()
  for (const p of prepared) {
    const task = `cc://task/${p.spec.task}`
    const rows = contract.adjusts.filter(
      (a) => a.task === task && a.date === p.date && (!p.spec.adjust || a.id === p.spec.adjust)
    )
    if (p.spec.adjust && rows.length === 0)
      throw new Error(`${p.spec.file}: adjust ${p.spec.adjust} not found`)
    let need = p.minutes
    for (const row of rows) {
      const take = Math.min(row.minutes, need)
      row.minutes -= take
      need -= take
      taken.set(p.spec.task, (taken.get(p.spec.task) ?? 0) + take)
    }
    for (const row of rows) {
      if (row.minutes === 0) contract.adjusts.splice(contract.adjusts.indexOf(row), 1)
    }
    if (need > 0)
      shortfalls.push(`${p.spec.file}: the meeting is ${p.minutes} min, the task is ${need} short`)
  }
  const after = sum() + moved
  for (const p of prepared) {
    console.log(
      `${p.spec.file}  ${p.start}–${p.end} (${p.minutes} min)  ${SERIES[p.spec.series].title}\n` +
        `    topics: ${p.topics.length} [${p.topics.join(' | ')}]` +
        (p.notes.length ? `\n    ${p.notes.join('; ')}` : '')
    )
  }
  console.log(
    `\nContract hours (adjusts + the meetings): ${before} min before; ${after} min after (adjusts ${sum()} + meetings ${moved}).`
  )
  if (shortfalls.length) {
    console.log('Shortfalls (the contract would grow):')
    for (const s of shortfalls) console.log(`  ${s}`)
  }
  if (after !== before || shortfalls.length) {
    console.log('\nRefusing: the contract total would change.')
    if (!outDir) process.exitCode = 1
  }

  // --- the database, on a throwaway copy unless applying ----------------------------------
  const scratch = mkdtempSync(join(tmpdir(), 'cc-luminos2-'))
  const copyFile = join(scratch, 'copy.sqlite')
  let dbFile = databaseFile
  if (!apply) {
    const reader = new Database(databaseFile, { readonly: true })
    reader.prepare('VACUUM INTO ?').run(copyFile)
    reader.close()
    dbFile = copyFile
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backups = join(root, 'backups', `luminos-meetings-2-${stamp}`)
  if (apply) {
    if (after !== before || shortfalls.length)
      throw new Error('The contract total would change; nothing written.')
    mkdirSync(join(backups, 'notes'), { recursive: true })
    cpSync(databaseFile, join(backups, 'central-command.sqlite'))
    cpSync(contractFile, join(backups, contractName))
  }
  const db = openDatabase(dbFile)
  const uids = new Map<string, string>()
  try {
    runMigrations(db, migrations)
    const store = new TasksStore(db)
    db.transaction(() => {
      const seriesUids = new Map<string, string>()
      const renamed = new Set<string>()
      for (const p of prepared) {
        const def = SERIES[p.spec.series]
        let seriesUid = seriesUids.get(p.spec.series)
        if (!seriesUid) {
          seriesUid = store.create({
            workspace: 'work',
            title: def.title,
            list: def.list,
            sublist: def.sublist
          }).uid
          seriesUids.set(p.spec.series, seriesUid)
        }
        const child = store.create({
          workspace: 'work',
          title: meetingTaskTitle(def.title, p.date),
          parentUid: seriesUid,
          due: p.date,
          status: 'done',
          ownKind: 'meeting'
        })
        uids.set(p.spec.file, child.uid)
        const old = store.get(p.spec.task)
        if (!old) throw new Error(`Task ${p.spec.task} is gone`)
        if (!renamed.has(p.spec.task)) {
          store.update(p.spec.task, { title: BROADER_TITLES[p.spec.task] ?? BROADER_TITLE })
          renamed.add(p.spec.task)
        }
        db.prepare(
          'UPDATE tasks SET earlier_minutes = MAX(0, earlier_minutes - ?) WHERE uid = ?'
        ).run(p.minutes, p.spec.task)
      }
      for (const rename of RESEARCH_RENAMES) {
        const task = store.get(rename.uid)
        if (!task || task.title !== rename.from)
          throw new Error(`${rename.uid} is not "${rename.from}" any more`)
        store.update(rename.uid, { title: rename.to })
        const subs = db
          .prepare(
            "SELECT uid, due FROM tasks WHERE parent_uid = ? AND own_kind = 'meeting' AND deleted_at IS NULL"
          )
          .all(rename.uid) as { uid: string; due: string }[]
        for (const sub of subs)
          store.update(sub.uid, { title: meetingTaskTitle(rename.to, sub.due) })
        console.log(
          `\nRenamed "${rename.from}" to "${rename.to}" and ${subs.length} meeting task(s).`
        )
      }
      for (const uid of seriesUids.values()) store.settleSeries(uid)
      for (const uid of seriesUids.values()) {
        const s = db
          .prepare('SELECT title, list, sublist, status, due FROM tasks WHERE uid = ?')
          .get(uid) as {
          title: string
          list: string
          sublist: string
          status: string
          due: string
        }
        const n = (
          db.prepare('SELECT COUNT(*) AS n FROM tasks WHERE parent_uid = ?').get(uid) as {
            n: number
          }
        ).n
        console.log(
          `\nSeries task "${s.title}" (${s.list}${s.sublist ? ' › ' + s.sublist : ''}): ${s.status}, due ${s.due}; ${n} meeting tasks.`
        )
      }
    })()
    for (const [task, minutes] of taken) {
      const t = db.prepare('SELECT title, earlier_minutes FROM tasks WHERE uid = ?').get(task) as {
        title: string
        earlier_minutes: number
      }
      console.log(
        `${task}: "${t.title}", earlier_minutes now ${t.earlier_minutes} (took ${minutes})`
      )
    }
  } finally {
    db.close()
  }

  // --- the notes ---------------------------------------------------------------------------
  for (const p of prepared) {
    const uid = uids.get(p.spec.file) as string
    const text = applyChanges(p.original, {
      meta: {
        start: p.start,
        end: p.end,
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
