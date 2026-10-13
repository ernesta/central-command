import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import type Database from 'better-sqlite3'
import { writeFileAtomicSync } from '../../../../main/atomic-write'
import { roundToQuarter } from '../../../../shared/tracking/rounding'
import { listTasks } from '../../../tasks/main/repository'
import { TasksStore } from '../../../tasks/main/tasks-store'
import type { Task } from '../../../tasks/shared/types'
import { meetingTaskTitle, proposeMeetingTask } from '../../shared/meeting-task'
import { applyChanges, parseMeta, splitNote } from '../../shared/front-matter'
import { durationMinutes } from '../../shared/time'

/**
 * One-off (12 Oct 2026, agreed with the user): every Research meeting note of the current year that has no task gets the task a new
 * meeting gets by itself (`planMeetingTask`): its own subtask, "<series> · <date>", under the series task ("Supervision" in
 * "Meetings", taken if it exists). A meeting whose hours already sit in a day's imported total (`days`, unlabelled) is taken out of
 * that total by the amount it reports (its length to the quarter), so Hours' sum does not change: the note's derived session is what
 * puts it back, labelled. Notes before the year, notes that already have a task and Work's notes are left alone.
 */
export const YEAR_START = '2026-09-21'
export const YEAR_FILE = '2026-27.json'

interface YearShape {
  days?: Record<string, { minutes?: number; note?: string }>
  [key: string]: unknown
}

export interface YearLinksReport {
  lines: string[]
  ok: boolean
  backup: string | null
}

interface Candidate {
  file: string
  text: string
  series: string
  date: string
  /** It pointed at the series task itself: its hours already come from the note, so no day total is touched. */
  onSeriesTask: boolean
  /** What it reports on Hours (quarter hours), 0 with no times. */
  minutes: number
}

/**
 * The notes to link: dated in the year (up to `today`), with a series and no task, or with the series task itself (13 Oct 2026:
 * "Rastle Lab" held its meeting's hours directly, with no subtask like Supervision's).
 */
export function candidates(
  notes: readonly { file: string; text: string }[],
  today: string,
  isSeriesTask: (task: string, series: string) => boolean = () => false
): Candidate[] {
  const found: Candidate[] = []
  for (const { file, text } of notes) {
    const { meta } = parseMeta(splitNote(text).head)
    if (!meta.date || meta.date < YEAR_START || meta.date > today) continue
    if (!meta.series) continue
    const onSeriesTask = meta.task !== '' && isSeriesTask(meta.task, meta.series)
    if (meta.task !== '' && !onSeriesTask) continue
    const length = durationMinutes(meta.start, meta.end)
    found.push({
      file,
      text,
      series: meta.series,
      onSeriesTask,
      date: meta.date,
      minutes: length === null ? 0 : roundToQuarter(length * 60)
    })
  }
  return found.sort((a, b) => a.date.localeCompare(b.date) || a.file.localeCompare(b.file))
}

/** The year file's text after taking each meeting out of its day's total, or the reason it cannot be done. */
export function planDaySplits(
  text: string,
  splits: readonly { date: string; minutes: number }[]
): { ok: true; next: string; lines: string[] } | { ok: false; problem: string } {
  let year: YearShape
  try {
    year = JSON.parse(text) as YearShape
  } catch {
    return { ok: false, problem: 'the year file is not JSON' }
  }
  // Written back the way the app writes it, so only the totals differ.
  if (JSON.stringify(year, null, 2) + '\n' !== text)
    return { ok: false, problem: 'the year file is not laid out the way the app writes it' }
  const lines: string[] = []
  for (const { date, minutes } of splits) {
    const day = year.days?.[date]
    if (!day || typeof day.minutes !== 'number') {
      lines.push(`${date}: no imported total, nothing to take out`)
      continue
    }
    if (day.minutes < minutes)
      return { ok: false, problem: `${date} holds ${day.minutes} min, less than ${minutes}` }
    lines.push(
      `${date}: total ${day.minutes} -> ${day.minutes - minutes} min (the meeting's ${minutes} min comes from the note)`
    )
    year.days![date] = { ...day, minutes: day.minutes - minutes }
  }
  return { ok: true, next: JSON.stringify(year, null, 2) + '\n', lines }
}

/**
 * Plans everything and, when `apply`, does it: any problem stops before the first write. Backs up the database, the meeting notes and
 * Research's hours first, and reads every file back.
 */
export function linkYearMeetings(
  root: string,
  db: Database.Database,
  apply: boolean,
  today: string,
  stamp: string
): YearLinksReport {
  const report: YearLinksReport = { lines: [], ok: true, backup: null }
  const bad = (line: string): void => {
    report.lines.push(line)
    report.ok = false
  }
  const notesDir = join(root, 'notes', 'meetings', 'research')
  const yearPath = join(root, 'time', 'research', YEAR_FILE)
  if (!existsSync(notesDir)) {
    bad('no Research meetings folder')
    return report
  }
  const notes = readdirSync(notesDir)
    .filter((f) => f.endsWith('.md'))
    .map((file) => ({ file, text: readFileSync(join(notesDir, file), 'utf8') }))
  const existing: Task[] = listTasks(db, 'research')
  const todo = candidates(notes, today, (uid, seriesName) => {
    const task = existing.find((t) => t.uid === uid)
    if (!task || task.parentUid) return false
    const proposal = proposeMeetingTask('research', seriesName, null, existing)
    return !!proposal && proposal.title.toLowerCase() === task.title.toLowerCase()
  })
  if (todo.length === 0) report.lines.push('nothing to link: every meeting of the year has a task')

  // Each series task is found once, or made once, however many meetings sit under it.
  const series = new Map<string, { title: string; list: string; uid: string | null }>()
  const plans = todo.map((c) => {
    const open = existing.filter((t) => t.status !== 'done')
    const proposal = proposeMeetingTask('research', c.series, null, open)
    if (!proposal) return { c, parent: null, title: '', reuse: null as Task | null }
    const key = proposal.title.toLowerCase()
    if (!series.has(key))
      series.set(key, {
        title: proposal.title,
        list: proposal.list,
        uid: proposal.existing?.uid ?? null
      })
    const title = meetingTaskTitle(proposal.title, c.date)
    const parentUid = series.get(key)!.uid
    const reuse = parentUid
      ? (existing.find((t) => t.parentUid === parentUid && t.title === title) ?? null)
      : null
    return { c, parent: key, title, reuse }
  })
  for (const s of series.values())
    report.lines.push(
      s.uid ? `series task exists: ${s.title}` : `make series task "${s.title}" in "${s.list}"`
    )
  for (const p of plans) {
    if (!p.parent) {
      bad(`${p.c.file}: series "${p.c.series}" names no task`)
      continue
    }
    report.lines.push(
      `${p.c.file}: ${p.reuse ? 'subtask exists' : 'make subtask'} "${p.title}" and link (${p.c.minutes} min on Hours)`
    )
  }

  let yearText = ''
  let split: ReturnType<typeof planDaySplits> | null = null
  const splits = plans
    .filter((p) => p.c.minutes > 0 && !p.reuse && !p.c.onSeriesTask)
    .map((p) => ({ date: p.c.date, minutes: p.c.minutes }))
  if (splits.length > 0) {
    if (!existsSync(yearPath)) bad(`${YEAR_FILE}: no such year file`)
    else {
      yearText = readFileSync(yearPath, 'utf8')
      split = planDaySplits(yearText, splits)
      if (!split.ok) bad(`${YEAR_FILE}: ${split.problem}`)
      else for (const l of split.lines) report.lines.push(l)
    }
  }
  if (!report.ok || !apply || todo.length === 0) return report

  report.backup = join(root, 'backups', `year-meeting-links-${stamp}`)
  mkdirSync(report.backup, { recursive: true })
  db.prepare('VACUUM INTO ?').run(join(report.backup, 'central-command.sqlite'))
  cpSync(notesDir, join(report.backup, 'meetings-research'), { recursive: true })
  cpSync(join(root, 'time', 'research'), join(report.backup, 'time-research'), { recursive: true })

  const store = new TasksStore(db)
  for (const s of series.values())
    if (!s.uid)
      s.uid = store.create({
        workspace: 'research',
        title: s.title,
        list: s.list,
        status: 'doing'
      }).uid
  const writes: { path: string; next: string }[] = plans.map((p) => {
    const uid =
      p.reuse?.uid ??
      store.create({
        workspace: 'research',
        title: p.title,
        parentUid: series.get(p.parent!)!.uid,
        status: 'done',
        due: p.c.date
      }).uid
    return { path: join(notesDir, p.c.file), next: applyChanges(p.c.text, { meta: { task: uid } }) }
  })
  if (split && split.ok) writes.push({ path: yearPath, next: split.next })
  for (const w of writes) writeFileAtomicSync(w.path, w.next)
  for (const w of writes)
    if (readFileSync(w.path, 'utf8') !== w.next) bad(`read-back differs: ${w.path}`)
  return report
}
