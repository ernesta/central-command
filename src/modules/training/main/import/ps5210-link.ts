import { cpSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import type Database from 'better-sqlite3'
import { writeFileAtomicSync } from '../../../../main/atomic-write'
import { TasksStore } from '../../../tasks/main/tasks-store'
import { TRAINING_LIST } from '../../shared/lecture-task'
import { applyTrainingChanges, parseTrainingMeta, splitNote } from '../../shared/front-matter'

/**
 * One-off (8 Oct 2026, agreed with the user): gives PS5210 Applied Neuroscience Methods its tasks and links its three notes.
 * A series task (named as the notes' series, in "Training") with one subtask per note (named as the note), each note gets
 * `task: <uid>`. The first lecture (30 Sep) is already inside Hours' unlabelled daily total, so that day is split without changing it:
 * the lecture's 2:00 leaves the total and comes back as a typed entry on its subtask marked `earlier`, so `withDerived` adds nothing
 * for it. The other two (7 Oct) are in no hours: their derived sessions are what adds them.
 */
export const PS5210_SERIES = 'PS5210 Applied Neuroscience Methods'
export const PS5210_NOTES = [
  {
    file: '2026-09-30 PS5210 Applied Neuroscience Methods - Introduction.md',
    title: 'Introduction'
  },
  { file: '2026-10-07 PS5210 Applied Neuroscience Methods - fNIRS.md', title: 'fNIRS' },
  {
    file: '2026-10-07 PS5210 Applied Neuroscience Methods - fNIRS Practical Lab.md',
    title: 'fNIRS Practical Lab'
  }
]
export const PS5210_YEAR_FILE = '2026-27.json'
/** The day whose total already holds the first lecture, and what the lecture takes out of it. */
export const PS5210_SPLIT = { date: '2026-09-30', minutes: 120 }

interface YearShape {
  days?: Record<string, { minutes?: number; note?: string }>
  adjusts?: {
    id: string
    date: string
    label: string
    minutes: number
    task?: string
    earlier?: true
  }[]
  [key: string]: unknown
}

export interface Ps5210Report {
  lines: string[]
  ok: boolean
  backup: string | null
}

/** The year file's text after the split, or the reason it cannot be done. Only `days[date]` and one new adjust differ. */
export function planDaySplit(
  text: string,
  taskUid: string,
  id: string
): { ok: true; next: string } | { ok: false; problem: string } {
  let year: YearShape
  try {
    year = JSON.parse(text) as YearShape
  } catch {
    return { ok: false, problem: 'the year file is not JSON' }
  }
  const { date, minutes } = PS5210_SPLIT
  const day = year.days?.[date]
  if (!day || typeof day.minutes !== 'number') return { ok: false, problem: `no total for ${date}` }
  if (day.minutes < minutes)
    return { ok: false, problem: `${date} holds ${day.minutes} min, less than ${minutes}` }
  const key = `cc://task/${taskUid}`
  if ((year.adjusts ?? []).some((a) => a.task === key))
    return { ok: false, problem: 'the lecture already has a typed entry' }
  const before = day.minutes
  year.days![date] = { ...day, minutes: before - minutes }
  year.adjusts = [
    ...(year.adjusts ?? []),
    { id, date, label: PS5210_NOTES[0].title, minutes, task: key, earlier: true }
  ]
  return { ok: true, next: JSON.stringify(year, null, 2) + '\n' }
}

interface Found {
  series: { uid: string } | null
  lectures: (string | null)[]
}

function findTasks(db: Database.Database): Found {
  const series = db
    .prepare(
      "SELECT uid FROM tasks WHERE workspace = 'research' AND deleted_at IS NULL AND parent_uid IS NULL AND title = ?"
    )
    .get(PS5210_SERIES) as { uid: string } | undefined
  const lectures = PS5210_NOTES.map((n) => {
    if (!series) return null
    const row = db
      .prepare('SELECT uid FROM tasks WHERE parent_uid = ? AND title = ? AND deleted_at IS NULL')
      .get(series.uid, n.title) as { uid: string } | undefined
    return row?.uid ?? null
  })
  return { series: series ?? null, lectures }
}

/**
 * Plans everything and, when `apply`, does it: all or nothing as far as checks go (any problem stops before the first write).
 * Backs up the database and the training notes and the Research hours first, and reads every file back.
 */
export function linkPs5210(
  root: string,
  db: Database.Database,
  apply: boolean,
  stamp: string
): Ps5210Report {
  const report: Ps5210Report = { lines: [], ok: true, backup: null }
  const bad = (line: string): void => {
    report.lines.push(line)
    report.ok = false
  }
  const notesDir = join(root, 'notes', 'training', 'research')
  const yearPath = join(root, 'time', 'research', PS5210_YEAR_FILE)
  const found = findTasks(db)
  if (found.series) report.lines.push(`series task exists: ${PS5210_SERIES}`)
  else report.lines.push(`make series task "${PS5210_SERIES}" in "${TRAINING_LIST}"`)

  const texts: string[] = []
  PS5210_NOTES.forEach((n, i) => {
    const path = join(notesDir, n.file)
    if (!existsSync(path)) return bad(`${n.file}: no such note`)
    const text = readFileSync(path, 'utf8')
    const meta = parseTrainingMeta(splitNote(text).head).meta
    if (meta.series !== PS5210_SERIES || meta.title !== n.title)
      return bad(`${n.file}: series or title is not what was agreed`)
    if (meta.task !== '' && meta.task !== found.lectures[i])
      return bad(`${n.file}: already has task ${meta.task}, left alone`)
    texts.push(text)
    report.lines.push(
      `${n.file}: ${found.lectures[i] ? 'subtask exists' : 'make subtask'} "${n.title}" and link (${meta.date} ${meta.start}-${meta.end})`
    )
  })
  if (!existsSync(yearPath)) bad(`${PS5210_YEAR_FILE}: no such year file`)
  let yearText = ''
  if (existsSync(yearPath)) {
    yearText = readFileSync(yearPath, 'utf8')
    const plan = planDaySplit(yearText, found.lectures[0] ?? 'dryrun00', 'dryrun00')
    if (!plan.ok) bad(`${PS5210_YEAR_FILE}: ${plan.problem}`)
    else
      report.lines.push(
        `${PS5210_SPLIT.date}: total lowered by ${PS5210_SPLIT.minutes} min and a typed entry of the same size added on "${PS5210_NOTES[0].title}" (earlier); the day's sum does not change`
      )
  }
  if (!report.ok || !apply) return report

  report.backup = join(root, 'backups', `ps5210-link-${stamp}`)
  mkdirSync(report.backup, { recursive: true })
  db.prepare('VACUUM INTO ?').run(join(report.backup, 'central-command.sqlite'))
  cpSync(notesDir, join(report.backup, 'training-research'), { recursive: true })
  cpSync(join(root, 'time', 'research'), join(report.backup, 'time-research'), { recursive: true })

  const store = new TasksStore(db)
  const parent =
    found.series ??
    store.create({
      workspace: 'research',
      title: PS5210_SERIES,
      list: TRAINING_LIST,
      status: 'doing'
    })
  const uids = PS5210_NOTES.map(
    (n, i) =>
      found.lectures[i] ??
      store.create({
        workspace: 'research',
        title: n.title,
        parentUid: parent.uid,
        status: 'done',
        due: n.file.slice(0, 10)
      }).uid
  )
  const writes: { path: string; next: string }[] = PS5210_NOTES.map((n, i) => ({
    path: join(notesDir, n.file),
    next: applyTrainingChanges(texts[i], { meta: { task: uids[i] } })
  }))
  const split = planDaySplit(yearText, uids[0], randomBytes(4).toString('hex'))
  if (!split.ok) {
    bad(`${PS5210_YEAR_FILE}: ${split.problem}`)
    return report
  }
  writes.push({ path: yearPath, next: split.next })
  for (const w of writes) writeFileAtomicSync(w.path, w.next)
  for (const w of writes)
    if (readFileSync(w.path, 'utf8') !== w.next) bad(`read-back differs: ${w.path}`)
  return report
}
