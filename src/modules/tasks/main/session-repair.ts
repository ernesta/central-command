import type { Database } from 'better-sqlite3'
import { formatDate } from '@shared/time'
import {
  isOwnMeetingTask,
  meetingTaskTitle,
  planMeetingTask,
  type MeetingParent
} from '../../meetings/shared/meeting-task'
import type { MeetingWorkspace } from '../../meetings/shared/types'
import { TRAINING_LIST } from '../../training/shared/training-task'
import { seriesChanges } from '../shared/session-task'
import { TASK_WORKSPACES, type OwnKind, type Task, type TaskStatus } from '../shared/types'
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

/** A Research training note and the tasks it names (`task:` and `selfstudy:`). */
export interface RepairTraining {
  id: string
  title: string
  date: string
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

export type TrainingState =
  /** Marked already (or no mark needed). */
  | 'in-step'
  /** `--apply` marks it. */
  | 'mark'
  /** Not the app's own kind of task (a task you chose, or a series task): never touched. */
  | 'chosen'
  /** Two notes name it: left alone, as with meetings. */
  | 'shared'
  | 'missing'
  | 'in-trash'

/** One task a training note names, and what `--apply` would do about its marker. */
export interface TrainingLine {
  id: string
  title: string
  date: string
  kind: 'training' | 'self-study'
  task: string
  state: TrainingState
  taskTitle?: string
  parentTitle?: string
  /** The notes that name the same task. */
  sharedWith: string[]
}

/** A series task (what meeting or training tasks sit under) and how it differs from the latest date of its subtasks and their status. */
export interface SeriesLine {
  uid: string
  title: string
  list: string
  kids: number
  due: string | null
  status: TaskStatus
  newDue?: string | null
  newStatus?: TaskStatus
}

export interface RepairReport {
  meetings: MeetingLine[]
  orphans: OrphanLine[]
  trainings: TrainingLine[]
  /** Training notes that name no task at all (`task:` empty). */
  noTask: { id: string; title: string; date: string }[]
  /** Series tasks that are out of step with their subtasks (every series is checked; only these are listed). */
  series: SeriesLine[]
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
        `SELECT entry_id AS id, title, date, task, self_study_task AS selfStudy FROM training WHERE workspace = 'research' ORDER BY date, entry_id`
      )
      .all() as RepairTraining[]
  }
}

/**
 * What is wrong with the meeting and training tasks, and what `--apply` would do about it. Pure: the same input gives the same
 * report. Nothing is ever proposed for deletion: orphans are listed with the time tracked on them, and trashing is the user's call.
 *
 * - Every meeting that names a task: does it exist, is it the meeting's own (marker, or the old title), has it the title, series task
 *   and due date the note calls for, do two meetings share it, is the marker missing.
 * - Every own-looking meeting subtask no meeting points to (orphans).
 *
 * `clients` is Work's list of clients; `tracked` the minutes tracked per task uid.
 */
export function planRepair(
  input: RepairInput,
  clients: readonly string[] | null,
  tracked: ReadonlyMap<string, number>
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

  for (const t of input.training) {
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

  const marks = new Map<string, OwnKind>()
  for (const m of meetings) if (m.fix?.mark) marks.set(m.fix.uid, m.fix.mark)
  const { trainings, noTask } = planTrainings(input, live, byUid)
  for (const t of trainings) if (t.state === 'mark') marks.set(t.task, t.kind)
  return { meetings, orphans, trainings, noTask, series: planSeries(live, marks) }
}

/** Each task a Research training note names, and whether it gets the marker (the sweep's own rule for what is the training's own). */
function planTrainings(
  input: RepairInput,
  live: readonly RepairTask[],
  byUid: ReadonlyMap<string, RepairTask>
): { trainings: TrainingLine[]; noTask: RepairReport['noTask'] } {
  const hasKids = (uid: string): boolean => live.some((t) => t.parentUid === uid)
  const trainings: TrainingLine[] = []
  const noTask: RepairReport['noTask'] = []
  const naming = (uid: string, id: string): string[] =>
    input.training
      .filter((o) => o.id !== id && (o.task === uid || o.selfStudy === uid))
      .map((o) => `research: ${o.id}`)
  for (const n of input.training) {
    if (!n.task && !n.selfStudy) noTask.push({ id: n.id, title: n.title, date: n.date })
    const named: [string, 'training' | 'self-study'][] = [
      [n.task, 'training'],
      [n.selfStudy, 'self-study']
    ]
    for (const [uid, kind] of named) {
      if (!uid || uid === 'auto') continue
      const task = byUid.get(uid)
      const line: TrainingLine = {
        id: n.id,
        title: n.title,
        date: n.date,
        kind,
        task: uid,
        state: 'in-step',
        sharedWith: naming(uid, n.id)
      }
      trainings.push(line)
      if (!task) {
        line.state = 'missing'
        continue
      }
      line.taskTitle = task.title
      line.parentTitle = task.parentUid ? byUid.get(task.parentUid)?.title : undefined
      if (task.deletedAt !== null) line.state = 'in-trash'
      else if (line.sharedWith.length > 0) line.state = 'shared'
      else if (task.ownKind !== null) line.state = 'in-step'
      else {
        // The sweep's rule: a training's own task is a subtask, or the top-level task in Training with nothing under it.
        // A self-study task is always a subtask.
        const own =
          kind === 'self-study'
            ? task.parentUid !== null
            : task.parentUid !== null ||
              (task.list.toLowerCase() === TRAINING_LIST.toLowerCase() && !hasKids(task.uid))
        line.state = own ? 'mark' : 'chosen'
      }
    }
  }
  return { trainings, noTask }
}

/** Every series task as it would stand once the markers are on, with the date and status its subtasks call for (only those that differ). */
function planSeries(
  live: readonly RepairTask[],
  marks: ReadonlyMap<string, OwnKind>
): SeriesLine[] {
  const effective = live.map((t) => ({ ...t, ownKind: marks.get(t.uid) ?? t.ownKind }))
  const lines: SeriesLine[] = []
  for (const parent of effective) {
    if (parent.parentUid) continue
    const kids = effective.filter((k) => k.parentUid === parent.uid)
    const changes = seriesChanges(parent, kids)
    if (changes.due === undefined && changes.status === undefined) continue
    lines.push({
      uid: parent.uid,
      title: parent.title,
      list: parent.list,
      kids: kids.length,
      due: parent.due,
      status: parent.status,
      ...(changes.due !== undefined ? { newDue: changes.due } : {}),
      ...(changes.status !== undefined ? { newStatus: changes.status } : {})
    })
  }
  return lines
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
    `ORPHANED OWN-LOOKING MEETING TASKS: ${report.orphans.length} (no meeting names them; --apply trashes those with no time tracked)`
  )
  for (const o of report.orphans) {
    const advice = o.trackedMinutes === 0 ? 'would be trashed' : 'KEEP: has time in Hours'
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
  const countT = (state: TrainingState): number =>
    report.trainings.filter((t) => t.state === state).length
  say(`TRAININGS (Research): ${report.trainings.length} task(s) named by the notes`)
  say(
    `  would be marked ${countT('mark')}, already marked ${countT('in-step')}, not the app's kind (never touched) ${countT('chosen')}, ` +
      `shared by two notes (left alone) ${countT('shared')}, in the trash ${countT('in-trash')}, missing ${countT('missing')}`
  )
  for (const t of report.trainings) {
    if (t.state === 'in-step') continue
    const head = `  ${t.id} (${t.date || 'no date'}, ${t.kind})`
    const parent = t.parentTitle ? ` under "${t.parentTitle}"` : ''
    if (t.state === 'mark') say(`${head}: task "${t.taskTitle}"${parent} → mark as ${t.kind}`)
    else if (t.state === 'chosen')
      say(
        `${head}: task "${t.taskTitle}"${parent} is one you chose (a series or another list; never touched)`
      )
    else if (t.state === 'shared')
      say(
        `${head}: task "${t.taskTitle}"${parent} is also named by ${t.sharedWith.join('; ')} (left alone)`
      )
    else if (t.state === 'in-trash')
      say(`${head}: task "${t.taskTitle}" is in the trash (cannot match; left alone)`)
    else say(`${head}: task ${t.task} does not exist (cannot match; left alone)`)
  }
  say(`  notes that name no task: ${report.noTask.length}`)
  for (const n of report.noTask) say(`    ${n.id} (${n.date || 'no date'}) "${n.title}"`)

  say()
  say(
    `SERIES TASKS out of step with their subtasks: ${report.series.length} (date = latest subtask, Done once all are)`
  )
  for (const s of report.series) {
    const parts: string[] = []
    if (s.newDue !== undefined) parts.push(`due ${s.due ?? 'none'} → ${s.newDue ?? 'none'}`)
    if (s.newStatus !== undefined) parts.push(`${s.status} → ${s.newStatus}`)
    say(`  "${s.title}" in ${s.list} (${s.kids} subtask(s)): ${parts.join('; ')}`)
  }

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
 * series task, and the orphans with no time tracked go to the Tasks trash. Afterwards the report is worked out again and must find
 * nothing left to do, or everything is rolled back and an error is thrown ("refuses to write unless the result verifies"). The tasks
 * the Research training notes name get their markers (only a task the sweep takes to be the training's own: a subtask, or the
 * top-level task in Training with nothing under it), and series tasks are brought in step with their subtasks. Nothing else of a
 * training is touched: the user maps them to tasks and hours by hand.
 */
export function applyRepair(
  db: Database,
  clients: readonly string[] | null,
  tracked: ReadonlyMap<string, number>
): { marked: number; changed: number; trashed: number } {
  const store = new TasksStore(db)
  let marked = 0
  let changed = 0
  let trashed = 0
  db.transaction(() => {
    const report = planRepair(readRepairInput(db), clients, tracked)
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
    // The tasks the training notes name get their markers: they are then locked, linked to their notes and kept by the sweep.
    for (const t of report.trainings) {
      if (t.state !== 'mark') continue
      store.update(t.task, { ownKind: t.kind })
      marked++
    }
    // Series tasks follow their subtasks (updating a subtask settles its series; the rest are settled here).
    for (const s of planRepair(readRepairInput(db), clients, tracked).series) {
      if (store.settleSeries(s.uid)) changed++
    }
    // Own-looking subtasks no meeting names and no time is tracked on: to the Tasks trash (restorable). One with time is kept.
    for (const o of report.orphans) {
      if (o.trackedMinutes > 0) continue
      store.delete(o.uid)
      trashed++
    }
    const after = planRepair(readRepairInput(db), clients, tracked)
    const left =
      after.meetings.filter((m) => m.fix).length +
      after.orphans.filter((o) => o.trackedMinutes === 0).length +
      after.trainings.filter((t) => t.state === 'mark').length +
      after.series.length
    if (left > 0)
      throw new Error(`Refusing to write: ${left} item(s) would still need repair afterwards`)
  })()
  return { marked, changed, trashed }
}
