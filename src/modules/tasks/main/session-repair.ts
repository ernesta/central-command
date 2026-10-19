import type { Database } from 'better-sqlite3'
import { formatDate } from '@shared/time'
import {
  isOwnMeetingTask,
  meetingTaskTitle,
  planMeetingTask,
  type MeetingParent
} from '../../meetings/shared/meeting-task'
import type { MeetingWorkspace } from '../../meetings/shared/types'
import { isLectureOwn } from '../../training/shared/lecture-task'
import { isSelfStudyOwn } from '../../training/shared/self-study-task'
import { selfStudyDoneAt, selfStudyTaskChanges, type LocalMoment } from '../shared/session-task'
import { TASK_WORKSPACES, type OwnKind, type Task } from '../shared/types'
import { listTasks, listTrash } from './repository'
import { TasksStore } from './tasks-store'

/** A task as the repair sees it: live, or in the trash. */
export interface RepairTask extends Task {
  deletedAt: string | null
}

export interface RepairMeeting {
  workspace: MeetingWorkspace
  id: string
  task: string
  series: string
  date: string
}

export interface RepairTraining {
  id: string
  title: string
  series: string | null
  date: string
  end: string | null
  task: string
  selfStudy: string
}

export interface RepairInput {
  tasks: RepairTask[]
  meetings: RepairMeeting[]
  training: RepairTraining[]
}

/** What `--apply` would do to one meeting's task. */
export interface MeetingFix {
  workspace: MeetingWorkspace
  meetingId: string
  uid: string
  mark?: OwnKind
  title?: string
  due?: string
  parent?: MeetingParent
}

export type MeetingState =
  /** The note says `auto`: no task yet (made when the note is next opened with a series and a date). */
  | 'auto'
  /** The uid is in the Tasks trash. */
  | 'in-trash'
  /** No task has this uid at all. */
  | 'missing'
  /** The task is one the user chose: never touched. */
  | 'chosen'
  | 'own'

export interface MeetingLine {
  workspace: MeetingWorkspace
  id: string
  series: string
  date: string
  task: string
  state: MeetingState
  taskTitle?: string
  parentTitle?: string
  due?: string | null
  /** Other meetings naming the same task. */
  sharedWith: string[]
  /** The marker the task lacks: it is recognised by its old title. */
  markerMissing: boolean
  /** The title it should have, when it differs. */
  expectedTitle?: string
  fix: MeetingFix | null
}

export interface OrphanLine {
  uid: string
  title: string
  list: string
  parentTitle: string
  due: string | null
  status: string
  createdAt: string
  trackedMinutes: number
  /** Recognised only by its old title: the marker is missing. */
  markerMissing: boolean
}

export interface TrainingLine {
  id: string
  title: string
  date: string
  series: string | null
  /** The self-study task it would get: the due date and the moment it is done. */
  due: string
  doneAt: LocalMoment
  /** Already past that moment: made done at once. */
  doneNow: boolean
}

export interface TrainingMark {
  id: string
  uid: string
  kind: 'lecture' | 'self-study'
  title: string
}

export interface RepairReport {
  meetings: MeetingLine[]
  orphans: OrphanLine[]
  trainingMissing: TrainingLine[]
  trainingMarks: TrainingMark[]
  /** Entries whose note names a self-study task that is gone: left alone, never made again by itself. */
  trainingGone: { id: string; selfStudy: string }[]
  /** Entries still waiting for a title or a date. */
  trainingWaiting: number
  trainingWithTask: number
}

/** Everything the report reads, from a database (live and trashed tasks, the meetings and training index). */
export function readRepairInput(db: Database): RepairInput {
  const live = TASK_WORKSPACES.flatMap((w) => listTasks(db, w)).map((t): RepairTask => ({
    ...t,
    deletedAt: null
  }))
  const gone = listTrash(db).map(({ task, deletedAt }): RepairTask => ({ ...task, deletedAt }))
  return {
    tasks: [...live, ...gone],
    meetings: db
      .prepare(
        'SELECT workspace, meeting_id AS id, task, series, date FROM meetings ORDER BY date, meeting_id'
      )
      .all() as RepairMeeting[],
    training: db
      .prepare(
        `SELECT entry_id AS id, title, series, date, end_time AS end, task, self_study_task AS selfStudy
         FROM training WHERE workspace = 'research' ORDER BY date, entry_id`
      )
      .all() as RepairTraining[]
  }
}

const named = (title: string): boolean => title.trim() !== '' && title.trim() !== 'Untitled'

/**
 * What is wrong with the meeting and training tasks, and what `--apply` would do about it. Pure: the same input gives the same
 * report. Nothing is ever proposed for deletion: orphans are listed with the time tracked on them, and trashing is the user's call.
 *
 * - Every meeting that names a task: does it exist, is it the meeting's own (marker, or the old title), has it the title, series task
 *   and due date the note calls for, do two meetings share it, is the marker missing.
 * - Every own-looking meeting subtask no meeting points to (orphans).
 * - Every Research training entry with a title and a date and no self-study task, with the due date and the done moment it would get.
 * - The markers the training tasks lack.
 *
 * `clients` is Work's list of clients; `tracked` the minutes tracked per task uid.
 */
export function planRepair(
  input: RepairInput,
  clients: readonly string[] | null,
  tracked: ReadonlyMap<string, number>,
  now: LocalMoment
): RepairReport {
  const live = input.tasks.filter((t) => t.deletedAt === null)
  const byUid = new Map(input.tasks.map((t) => [t.uid, t]))
  const pointed = new Set<string>()

  const meetings: MeetingLine[] = []
  for (const m of input.meetings) {
    if (!m.task) continue
    const line: MeetingLine = {
      workspace: m.workspace,
      id: m.id,
      series: m.series,
      date: m.date,
      task: m.task,
      state: 'own',
      sharedWith: [],
      markerMissing: false,
      fix: null
    }
    meetings.push(line)
    if (m.task === 'auto') {
      line.state = 'auto'
      continue
    }
    pointed.add(m.task)
    line.sharedWith = input.meetings
      .filter((o) => o.task === m.task && !(o.workspace === m.workspace && o.id === m.id))
      .map((o) => `${o.workspace}: ${o.id}`)
    const task = byUid.get(m.task)
    if (!task) {
      line.state = 'missing'
      continue
    }
    line.taskTitle = task.title
    line.due = task.due
    line.parentTitle = task.parentUid ? byUid.get(task.parentUid)?.title : undefined
    if (task.deletedAt !== null) {
      line.state = 'in-trash'
      continue
    }
    if (!isOwnMeetingTask(task)) {
      line.state = 'chosen'
      continue
    }
    line.markerMissing = task.ownKind === null
    const fix: MeetingFix = { workspace: m.workspace, meetingId: m.id, uid: task.uid }
    if (line.markerMissing) fix.mark = 'meeting'
    const plan = planMeetingTask(
      m.workspace,
      { task: m.task, series: m.series, date: m.date },
      m.workspace === 'work' ? clients : null,
      live
    )
    if (plan.kind === 'sync') {
      if (plan.title !== undefined) {
        fix.title = plan.title
        line.expectedTitle = plan.title
      }
      if (plan.due !== undefined) fix.due = plan.due
      if (plan.parent !== undefined) fix.parent = plan.parent
    }
    if (fix.mark || fix.title !== undefined || fix.due !== undefined || fix.parent) line.fix = fix
  }

  const training = input.training
  for (const t of training) {
    for (const uid of [t.task, t.selfStudy]) if (uid && uid !== 'auto') pointed.add(uid)
  }
  const orphans: OrphanLine[] = live
    .filter((t) => t.parentUid && !pointed.has(t.uid) && isOwnMeetingTask(t))
    .map((t) => ({
      uid: t.uid,
      title: t.title,
      list: byUid.get(t.parentUid as string)?.list ?? '',
      parentTitle: byUid.get(t.parentUid as string)?.title ?? '',
      due: t.due,
      status: t.status,
      createdAt: t.createdAt,
      trackedMinutes: tracked.get(t.uid) ?? 0,
      markerMissing: t.ownKind === null
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const trainingMissing: TrainingLine[] = []
  const trainingMarks: TrainingMark[] = []
  const trainingGone: { id: string; selfStudy: string }[] = []
  let trainingWaiting = 0
  let trainingWithTask = 0
  for (const t of training) {
    const lecture = t.task && t.task !== 'auto' ? live.find((x) => x.uid === t.task) : undefined
    if (lecture && lecture.ownKind === null && isLectureOwn(lecture, live)) {
      trainingMarks.push({ id: t.id, uid: lecture.uid, kind: 'lecture', title: lecture.title })
    }
    const study = t.selfStudy ? live.find((x) => x.uid === t.selfStudy) : undefined
    if (study) {
      trainingWithTask++
      if (study.ownKind === null && isSelfStudyOwn(study, live)) {
        trainingMarks.push({ id: t.id, uid: study.uid, kind: 'self-study', title: study.title })
      }
      continue
    }
    if (t.selfStudy) {
      trainingGone.push({ id: t.id, selfStudy: t.selfStudy })
      continue
    }
    if (!named(t.title) || !t.date) {
      trainingWaiting++
      continue
    }
    const session = { date: t.date, end: t.end }
    const doneAt = selfStudyDoneAt(session) as LocalMoment
    const probe = { status: 'doing', due: null } as Task
    trainingMissing.push({
      id: t.id,
      title: t.title,
      date: t.date,
      series: t.series,
      due: t.date,
      doneAt,
      doneNow: selfStudyTaskChanges(probe, session, now).done === true
    })
  }

  return {
    meetings,
    orphans,
    trainingMissing,
    trainingMarks,
    trainingGone,
    trainingWaiting,
    trainingWithTask
  }
}

const minutes = (n: number): string => (n === 0 ? 'no time tracked' : `${n} min tracked`)

/** The report as text, every line of it. `region` names how dates are written, for the reader. */
export function formatRepairReport(report: RepairReport, region: string): string {
  const out: string[] = []
  const say = (line = ''): number => out.push(line)
  const fixes = report.meetings.filter((m) => m.fix)

  say(`Dates in titles are written for ${region} (this terminal's region; the app uses the Mac's).`)
  say()
  say(`MEETINGS: ${report.meetings.length} name a task`)
  const count = (state: MeetingState): number =>
    report.meetings.filter((m) => m.state === state).length
  say(
    `  own ${count('own')}, chosen by you ${count('chosen')}, "auto" (no task yet) ${count('auto')}, ` +
      `task in the trash ${count('in-trash')}, task missing ${count('missing')}`
  )
  say(`  marker missing: ${report.meetings.filter((m) => m.markerMissing).length}`)
  say(`  shared by two meetings: ${report.meetings.filter((m) => m.sharedWith.length > 0).length}`)
  say(`  would change: ${fixes.length}`)
  for (const m of report.meetings) {
    if (m.state === 'own' && !m.fix && m.sharedWith.length === 0) continue
    if (m.state === 'auto') continue
    const head = `  [${m.workspace}] ${m.id} (${m.series || 'no series'}, ${m.date || 'no date'})`
    if (m.state === 'missing') say(`${head}: task ${m.task} does not exist (left alone)`)
    else if (m.state === 'in-trash')
      say(`${head}: task "${m.taskTitle}" is in the trash (left alone)`)
    else if (m.state === 'chosen')
      say(`${head}: task "${m.taskTitle}" is one you chose (never touched)`)
    else {
      const parts: string[] = []
      if (m.fix?.mark) parts.push("mark it as the meeting's own")
      if (m.fix?.title !== undefined) parts.push(`rename "${m.taskTitle}" to "${m.fix.title}"`)
      if (m.fix?.due !== undefined) parts.push(`set due ${m.fix.due} (now ${m.due ?? 'none'})`)
      if (m.fix?.parent) {
        const to =
          'uid' in m.fix.parent
            ? 'the existing series task'
            : `a new "${m.fix.parent.title}" in ${m.fix.parent.list}`
        parts.push(`move it from "${m.parentTitle ?? '?'}" to ${to}`)
      }
      if (m.sharedWith.length > 0) parts.push(`SHARED with ${m.sharedWith.join('; ')}`)
      say(`${head}: task "${m.taskTitle}" → ${parts.join('; ') || 'in step'}`)
    }
  }

  say()
  say(
    `ORPHANED OWN-LOOKING MEETING TASKS: ${report.orphans.length} (no meeting names them; nothing is trashed by the script)`
  )
  for (const o of report.orphans) {
    const advice = o.trackedMinutes === 0 ? 'candidate to trash' : 'KEEP: has time in Hours'
    say(
      `  "${o.title}" in ${o.list || '?'} › ${o.parentTitle || '?'}; due ${o.due ?? 'none'}; ${o.status}; made ${o.createdAt.slice(0, 10)}; ` +
        `${minutes(o.trackedMinutes)}; ${o.markerMissing ? 'no marker' : 'marked'}; ${advice} (${o.uid})`
    )
  }
  const named19 = report.orphans.filter(
    (o) =>
      /^Supervision · .*19 Oct(?:ober)?\.? 2026$|^Supervision · Oct 19, 2026$/.test(o.title) &&
      o.list === 'Meetings'
  )
  say(`  "Supervision · 19 Oct 2026" in Meetings, pointed at by no meeting: ${named19.length}`)

  say()
  const other = report.meetings.filter((m) => m.series === 'Other' && m.date === '2026-10-20')
  if (other.length === 0) say('CHECK "Other · 20 Oct 2026": no such meeting in the library.')
  for (const m of other) {
    say(
      `CHECK "Other · 20 Oct 2026" (${m.id}): task "${m.taskTitle ?? m.task}"` +
        (m.fix?.title !== undefined ? ` would become "${m.fix.title}"` : ' is in step')
    )
  }

  say()
  const history = report.trainingMissing.filter((t) => t.doneNow).length
  say(
    `TRAININGS: ${report.trainingWithTask} have a self-study task, ${report.trainingMissing.length} would get one (${history} history, made by --apply only; ${report.trainingMissing.length - history} the app makes by itself), ${report.trainingWaiting} wait for a title or a date, ${report.trainingGone.length} name a self-study task that is gone (left alone)`
  )
  for (const t of report.trainingMissing) {
    say(
      `  ${t.id}${t.series ? ` [${t.series}]` : ''}: make "${t.title} self-study", due ${t.due}, done ${t.doneAt.date} ${t.doneAt.time}${t.doneNow ? ' (history: its week is over, done at once; only --apply makes it)' : ' (the app makes it by itself)'}`
    )
  }
  say(`  markers missing on training tasks: ${report.trainingMarks.length}`)
  for (const m of report.trainingMarks) say(`  ${m.id}: mark "${m.title}" as ${m.kind}`)
  for (const g of report.trainingGone) say(`  ${g.id}: self-study task ${g.selfStudy} is gone`)
  return out.join('\n')
}

/** The region the dates are written for, as a name. */
export function dateRegion(): string {
  return `${new Intl.DateTimeFormat().resolvedOptions().locale} (e.g. ${formatDate('2026-10-19')})`
}

/** The title a meeting's own task should have, for a quick check by callers. */
export { meetingTaskTitle }

/**
 * Applies the task side of a report to a database inside one transaction: the markers, and each meeting task's title, due date and
 * series task. Afterwards the report is worked out again and must find nothing left to do, or everything is rolled back and an error
 * is thrown ("refuses to write unless the result verifies"). Training self-study tasks are made by the sweep, which needs the notes.
 */
export function applyRepair(
  db: Database,
  clients: readonly string[] | null,
  tracked: ReadonlyMap<string, number>,
  now: LocalMoment
): { marked: number; changed: number } {
  const store = new TasksStore(db)
  let marked = 0
  let changed = 0
  db.transaction(() => {
    const report = planRepair(readRepairInput(db), clients, tracked, now)
    for (const m of report.meetings) {
      const fix = m.fix
      if (!fix) continue
      let parentUid: string | undefined
      if (fix.parent) {
        parentUid =
          'uid' in fix.parent
            ? fix.parent.uid
            : store.create({
                workspace: fix.workspace,
                title: fix.parent.title,
                list: fix.parent.list
              }).uid
      }
      store.update(fix.uid, {
        ...(fix.mark ? { ownKind: fix.mark } : {}),
        ...(fix.title !== undefined ? { title: fix.title } : {}),
        ...(fix.due !== undefined ? { due: fix.due } : {}),
        ...(parentUid ? { parentUid } : {})
      })
      if (fix.mark) marked++
      if (fix.title !== undefined || fix.due !== undefined || parentUid) changed++
    }
    for (const mark of report.trainingMarks) {
      store.update(mark.uid, { ownKind: mark.kind })
      marked++
    }
    const after = planRepair(readRepairInput(db), clients, tracked, now)
    const left = after.meetings.filter((m) => m.fix).length + after.trainingMarks.length
    if (left > 0)
      throw new Error(`Refusing to write: ${left} item(s) would still need repair afterwards`)
  })()
  return { marked, changed }
}
