import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import type Database from 'better-sqlite3'
import { fold } from '../../../../shared/text'
import { durationMinutes } from '../../../../shared/time'
import { reportedMinutes } from '../../../../shared/tracking/rounding'
import type { TrackingYear } from '../../../../shared/tracking/types'
import { writeFileAtomicSync } from '../../../../main/atomic-write'
import { TasksStore } from '../../../tasks/main/tasks-store'
import { selfStudyDue } from '../../../tasks/shared/session-task'
import { taskKey, trackedByTask } from '../../../tasks/shared/tracked'
import { applyTrainingChanges, parseTrainingMeta, splitNote } from '../../shared/front-matter'
import { entryParts } from '../../shared/rules'
import { bareTitle, TRAINING_LIST } from '../../shared/training-task'
import { selfStudyTaskTitle, selfStudyTitle } from '../../shared/self-study-task'

/**
 * One-off (25 Oct 2026, the user's request): connects the ClickUp "Complete SENSS Experimental Methods in the Social Sciences" task
 * and its "Complete <training>" subtasks to the four training notes of the series, and gives each training its self-study task.
 *
 * - The series task and the subtasks that match a note by title lose "Complete ", take the note's title and date, and are marked
 *   `training`; each note gets `task: <uid>`. Subtasks no note names (the five already in the trash) are left as they are.
 * - A `<series> self-study` task with one self-study subtask per note is made, named and dated the way the app names them
 *   (`selfStudyTaskTitle`, `selfStudyDue`), done (all past); each note gets `selfstudy: <uid>`.
 * - A session over 3 hours is cut to 3 hours (the note's end) and the rest is typed on the training's self-study task, on the
 *   session's date, so the entry's total is the same.
 * - The hours move, the sum does not (the user, 25 Oct 2026): each session is typed on its own day as `earlier` (so the note is not
 *   counted again), and the same minutes come off the days ClickUp logged them (`CLICKUP_TIME`), the rest off the day named there. A
 *   training task's ClickUp figure is set to its session. The script refuses to go on if the Research total would change.
 */
export const SENSS_SERIES = 'SENSS Experimental Methods in the Social Sciences'
export const SENSS_SERIES_TASK = 'rtcc43ae'
export const SESSION_CAP_MINUTES = 180

/**
 * The time ClickUp held for each training, by entry date (read from ClickUp on 25 Oct 2026), and the day whose total gives the rest
 * when ClickUp held less than the note (the user's rule: the notes hold the right total; hours move, the sum does not).
 */
const CLICKUP_TIME: Record<
  string,
  { entries: { date: string; minutes: number }[]; shortfallDay: string }
> = {
  [fold('Introduction to Experimental Methods')]: {
    entries: [{ date: '2026-06-29', minutes: 180 }],
    shortfallDay: '2026-06-29'
  },
  [fold('Economic Games and Standard Lab Protocols')]: {
    entries: [
      { date: '2026-07-02', minutes: 45 },
      { date: '2026-07-08', minutes: 15 }
    ],
    shortfallDay: '2026-07-02'
  },
  [fold('Field Experiments and Randomised Controlled Trials')]: {
    entries: [
      { date: '2026-07-09', minutes: 165 },
      { date: '2026-07-10', minutes: 60 }
    ],
    shortfallDay: '2026-07-09'
  },
  [fold('Types of Randomisation and Power Calculations')]: {
    entries: [{ date: '2026-07-13', minutes: 165 }],
    shortfallDay: '2026-07-13'
  }
}

interface Note {
  file: string
  text: string
  date: string
  start: string
  end: string
  title: string
  task: string
  selfStudy: string
}

interface Row {
  uid: string
  title: string
  status: string
  due: string | null
  parent_uid: string | null
  earlier_minutes: number
  own_kind: string | null
  list: string
  deleted_at: string | null
}

interface YearFile {
  path: string
  text: string
  year: TrackingYear & { days: Record<string, { minutes?: number; note?: string }> }
}

export interface SenssReport {
  lines: string[]
  ok: boolean
  backup: string | null
}

const hm = (minutes: number): string =>
  `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
const addMinutes = (time: string, minutes: number): string => {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function readNotes(dir: string): Note[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .flatMap((file) => {
      const text = readFileSync(join(dir, file), 'utf8')
      const meta = parseTrainingMeta(splitNote(text).head).meta
      return meta.series === SENSS_SERIES
        ? [
            {
              file,
              text,
              date: meta.date,
              start: meta.start ?? '',
              end: meta.end ?? '',
              title: meta.title,
              task: meta.task,
              selfStudy: meta.selfStudy
            }
          ]
        : []
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

function readYears(root: string): YearFile[] {
  const dir = join(root, 'time', 'research')
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const text = readFileSync(join(dir, f), 'utf8')
      return { path: join(dir, f), text, year: JSON.parse(text) as YearFile['year'] }
    })
    .sort((a, b) => a.year.start.localeCompare(b.year.start))
}

/** The year file that holds a date: the latest one that starts on or before it. */
const yearFor = (years: readonly YearFile[], date: string): YearFile | undefined =>
  [...years].reverse().find((y) => y.year.start <= date)

/** The time Hours holds on a date for Research: the daily total, typed time, and (once linked) the note's derived session. */
function hoursOn(year: YearFile['year'], date: string, derived: number): number {
  const total = year.days[date]?.minutes ?? 0
  const typed = year.adjusts.filter((a) => a.date === date).reduce((s, a) => s + a.minutes, 0)
  const sessions = year.sessions
    .filter((s) => s.date === date && s.end !== null)
    .reduce((s, x) => s + reportedMinutes(x), 0)
  return total + typed + sessions + derived
}

/**
 * Plans everything and, when `apply`, does it: all or nothing as far as checks go (any problem stops before the first write).
 * Backs up the database, the training notes and Research's hours first, and reads every file back.
 */
export function linkSenss(
  root: string,
  db: Database.Database,
  apply: boolean,
  stamp: string
): SenssReport {
  const report: SenssReport = { lines: [], ok: true, backup: null }
  const say = (line = ''): void => void report.lines.push(line)
  const bad = (line: string): void => {
    report.lines.push(`PROBLEM: ${line}`)
    report.ok = false
  }
  const notesDir = join(root, 'notes', 'training', 'research')
  const notes = readNotes(notesDir)
  if (notes.length === 0) {
    bad(`no training note has the series "${SENSS_SERIES}"`)
    return report
  }
  const rows = db
    .prepare(
      "SELECT uid, title, status, due, parent_uid, earlier_minutes, own_kind, list, deleted_at FROM tasks WHERE workspace = 'research'"
    )
    .all() as Row[]
  const series = rows.find((r) => r.uid === SENSS_SERIES_TASK && !r.deleted_at)
  if (!series) {
    bad(`task ${SENSS_SERIES_TASK} is not there`)
    return report
  }
  const subtasks = rows.filter((r) => r.parent_uid === series.uid && !r.deleted_at)
  const years = readYears(root)

  // 1. Pair each note with its "Complete <title>" subtask.
  const pairs = notes.map((note) => {
    const found = subtasks.filter((s) => fold(bareTitle(s.title)) === fold(note.title))
    return { note, task: found.length === 1 ? found[0] : null, count: found.length }
  })
  for (const p of pairs) {
    if (p.count !== 1) bad(`${p.note.title}: ${p.count} subtasks match, expected 1`)
    if (p.note.task || p.note.selfStudy)
      bad(`${p.note.file}: already has a task link (${p.note.task} ${p.note.selfStudy})`)
    if (durationMinutes(p.note.start, p.note.end) === null) bad(`${p.note.file}: no times`)
    if (!yearFor(years, p.note.date)) bad(`${p.note.date}: no Research year file`)
  }
  const studySeriesTitle = selfStudyTitle(SENSS_SERIES)
  if (rows.some((r) => !r.deleted_at && fold(r.title) === fold(studySeriesTitle)))
    bad(`a task "${studySeriesTitle}" already exists`)
  if (!report.ok) return report

  // 2. The plan, per entry, and the hours before and after (in memory).
  const earlierAfter = new Map(rows.map((r) => [r.uid, r.earlier_minutes]))
  const plans = pairs.map(({ note, task }) => {
    const session = durationMinutes(note.start, note.end) as number
    const kept = Math.min(session, SESSION_CAP_MINUTES)
    const source = CLICKUP_TIME[fold(note.title)]
    if (!source) bad(`${note.title}: no ClickUp entries listed`)
    const found = (source?.entries ?? []).reduce((s, e) => s + e.minutes, 0)
    // What is taken off the days: the ClickUp entries, and the rest of the session (and its self-study) off the day named.
    const takeOff = [...(source?.entries ?? [])]
    if (found < session)
      takeOff.push({ date: source?.shortfallDay ?? note.date, minutes: session - found })
    earlierAfter.set((task as Row).uid, kept)
    return {
      note,
      task: task as Row,
      session,
      kept,
      remainder: session - kept,
      newEnd: session > kept ? addMinutes(note.start, kept) : note.end,
      studyTitle: selfStudyTaskTitle(note.title, SENSS_SERIES),
      studyDue: selfStudyDue(note.date),
      studyUid: `new${randomBytes(3).toString('hex')}`,
      adjustId: randomBytes(4).toString('hex'),
      remainderId: randomBytes(4).toString('hex'),
      takeOff,
      found
    }
  })
  if (!report.ok) return report

  const yearsBefore = years.map((y) => y.year)
  const trackedBefore = trackedByTask(
    yearsBefore,
    new Map(rows.map((r) => [r.uid, r.earlier_minutes]))
  )
  const after = years.map((y) => structuredClone(y.year))
  const yearOf = (date: string): number => years.indexOf(yearFor(years, date) as YearFile)
  const touched = new Set<string>()
  for (const p of plans) {
    for (const e of p.takeOff) {
      const y = after[yearOf(e.date)]
      const day = y.days[e.date]
      if (!day || typeof day.minutes !== 'number' || day.minutes < e.minutes) {
        bad(
          `${e.date}: the day holds ${day?.minutes ?? 0} min, cannot take ${e.minutes} off for "${p.note.title}"`
        )
        continue
      }
      y.days[e.date] = { ...day, minutes: day.minutes - e.minutes }
      touched.add(e.date)
    }
    const y = after[yearOf(p.note.date)]
    // The session is typed on its own day, `earlier`, so `withDerived` does not add the note's session on top of it.
    y.adjusts.push({
      id: p.adjustId,
      date: p.note.date,
      label: p.note.title,
      minutes: p.kept,
      task: taskKey(p.task.uid),
      earlier: true
    })
    if (p.remainder > 0)
      y.adjusts.push({
        id: p.remainderId,
        date: p.note.date,
        label: p.note.title,
        minutes: p.remainder,
        task: taskKey(p.studyUid)
      })
    touched.add(p.note.date)
  }
  if (!report.ok) return report
  const trackedAfter = trackedByTask(after, earlierAfter)
  const loggedAfter = trackedByTask(after)
  const yearTotal = (list: YearFile['year'][]): number =>
    list.reduce(
      (s, y) =>
        s +
        Object.values(y.days).reduce((a, d) => a + (d.minutes ?? 0), 0) +
        y.adjusts.reduce((a, x) => a + x.minutes, 0),
      0
    )
  if (yearTotal(yearsBefore) !== yearTotal(after)) {
    bad(`the year totals differ: ${hm(yearTotal(yearsBefore))} -> ${hm(yearTotal(after))}`)
    return report
  }

  // 3. The report.
  say(
    `Series task ${series.uid}: "${series.title}" -> "${SENSS_SERIES}" (stays in ${series.list || TRAINING_LIST}, ${series.status}; the app's series rule decides its status and date from the subtasks)`
  )
  say(
    `New series task: "${studySeriesTitle}" in ${TRAINING_LIST}, done, due ${plans[plans.length - 1].studyDue}`
  )
  say()
  for (const p of plans) {
    const t = p.task
    const row = (name: string, a: string, b: string): void =>
      say(`    ${name.padEnd(22)} ${a.padEnd(50)} -> ${b}`)
    say(`${p.note.date}  ${p.note.file}`)
    row('training task', `${t.uid} "${t.title}"`, `${t.uid} "${p.note.title}"`)
    row('  due / kind', `${t.due ?? '-'} / ${t.own_kind ?? '-'}`, `${p.note.date} / training`)
    row('  note link', 'task: -', `task: ${t.uid}`)
    row('self-study task', '(none)', `"${p.studyTitle}", due ${p.studyDue}, done`)
    row('  note link', 'selfstudy: -', 'selfstudy: <new task>')
    row(
      'note times',
      `${p.note.start}-${p.note.end} (${hm(p.session)})`,
      `${p.note.start}-${p.newEnd} (${hm(p.kept)})`
    )
    row(
      'ClickUp time on task',
      hm(t.earlier_minutes),
      `${hm(p.kept)} (display figure set to the session)`
    )
    row(
      'training task time',
      hm(t.earlier_minutes + (trackedBefore.get(t.uid) ?? 0)),
      hm(p.kept + (trackedAfter.get(t.uid) ?? 0))
    )
    const before = entryParts({ start: p.note.start, end: p.note.end, task: '', selfStudy: '' })
    const afterLog = entryParts(
      { start: p.note.start, end: p.newEnd, task: t.uid, selfStudy: 'x' },
      new Map([
        ['x', p.remainder],
        [t.uid, loggedAfter.get(t.uid) ?? 0]
      ])
    )
    row(
      'training log entry',
      `${hm((before?.training ?? 0) + (before?.selfStudy ?? 0))} (session only)`,
      `${hm((afterLog?.training ?? 0) + (afterLog?.selfStudy ?? 0))} = ${hm(afterLog?.training ?? 0)} session + ${hm(afterLog?.selfStudy ?? 0)} self-study`
    )
    row('self-study task time', '-', hm(p.remainder))
    say(
      `    hours moved here from: ${p.takeOff.map((e) => `${e.date} ${hm(e.minutes)}`).join(', ')}${p.found < p.session ? ` (ClickUp held ${hm(p.found)}; the rest is taken off the day's total)` : ''}`
    )
    say()
  }
  say('Research Hours per day (days that change):')
  for (const d of [...touched].sort()) {
    const b = hoursOn(yearsBefore[yearOf(d)], d, 0)
    const a = hoursOn(after[yearOf(d)], d, 0)
    say(
      `    ${d}  ${hm(b).padStart(6)} -> ${hm(a).padStart(6)}${a === b ? '' : `  (${a > b ? '+' : '-'}${hm(Math.abs(a - b))})`}`
    )
  }
  say(`    Research total, all days: ${hm(yearTotal(yearsBefore))} -> ${hm(yearTotal(after))}`)
  say(
    `Training log, the four entries: ${hm(plans.reduce((s, p) => s + p.session, 0))} -> ${hm(plans.reduce((s, p) => s + p.session, 0))}`
  )
  say(
    `Left alone: ${subtasks.length - plans.length} other live subtask(s) of the series task; the 5 already in the trash`
  )
  if (!apply) return report

  // 4. Apply: back up, tasks, notes, hours; then read the files back.
  report.backup = join(root, 'backups', `senss-experimental-${stamp}`)
  mkdirSync(report.backup, { recursive: true })
  db.prepare('VACUUM INTO ?').run(join(report.backup, 'central-command.sqlite'))
  cpSync(notesDir, join(report.backup, 'training-research'), { recursive: true })
  cpSync(join(root, 'time', 'research'), join(report.backup, 'time-research'), { recursive: true })

  const store = new TasksStore(db)
  store.update(series.uid, { title: SENSS_SERIES })
  const studySeries = store.create({
    workspace: 'research',
    title: studySeriesTitle,
    list: TRAINING_LIST,
    status: 'todo'
  })
  const writes: { path: string; next: string }[] = []
  for (const p of plans) {
    store.update(p.task.uid, { title: p.note.title, due: p.note.date, ownKind: 'training' })
    db.prepare('UPDATE tasks SET earlier_minutes = ? WHERE uid = ?').run(p.kept, p.task.uid)
    const doneAt = new Date(`${p.studyDue}T${p.note.end || '23:59'}:00`).toISOString()
    const study = store.create({
      workspace: 'research',
      title: p.studyTitle,
      parentUid: studySeries.uid,
      status: 'done',
      due: p.studyDue,
      completedAt: doneAt,
      ownKind: 'self-study'
    })
    // The typed time was planned against a placeholder uid: point it at the real task.
    for (const y of after)
      for (const a of y.adjusts) if (a.task === taskKey(p.studyUid)) a.task = taskKey(study.uid)
    writes.push({
      path: join(notesDir, p.note.file),
      next: applyTrainingChanges(p.note.text, {
        meta: {
          task: p.task.uid,
          selfStudy: study.uid,
          ...(p.remainder > 0 ? { end: p.newEnd } : {})
        }
      })
    })
  }
  years.forEach((y, i) => {
    const next = JSON.stringify(after[i], null, 2) + '\n'
    if (next !== y.text) writes.push({ path: y.path, next })
  })
  for (const w of writes) writeFileAtomicSync(w.path, w.next)
  for (const w of writes)
    if (readFileSync(w.path, 'utf8') !== w.next) bad(`read-back differs: ${w.path}`)
  if (!existsSync(report.backup)) bad('backup missing')
  return report
}
