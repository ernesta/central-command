import type { Database } from 'better-sqlite3'
import { selfStudyTaskChanges, type LocalMoment } from '../../tasks/shared/session-task'
import { listTasks } from '../../tasks/main/repository'
import type { TasksStore } from '../../tasks/main/tasks-store'
import type { Task } from '../../tasks/shared/types'
import { TRAINING_LIST, type ParentTarget } from '../shared/lecture-task'
import { isSelfStudyOwn, planSelfStudyTask } from '../shared/self-study-task'
import type { TrainingRef } from '../shared/types'
import { listTrainingRows } from './repository'
import type { TrainingStore } from './training-store'

/**
 * A note edited more recently than this is left for the next run: the user may be typing in it (its page saves a moment after each
 * keystroke), and a write of ours then would put the page in conflict with the file.
 */
export const QUIET_MS = 30_000

/** How many times the link into the note is tried when the file changes under us. */
const LINK_ATTEMPTS = 3

export interface SelfStudySweepOptions {
  db: Database
  tasks: TasksStore
  training: TrainingStore
  now: LocalMoment
  /** The clock in milliseconds, for the quiet period. */
  nowMs: number
  /** Overridable for tests. */
  quietMs?: number
}

/** Whether the app has closed this task before (so it never closes it again: a task reopened by hand stays open). */
const closedBefore = (db: Database, uid: string): boolean =>
  (
    db.prepare('SELECT auto_closed_at AS at FROM tasks WHERE uid = ?').get(uid) as
      { at: string | null } | undefined
  )?.at != null

const markClosed = (db: Database, uid: string): void => {
  db.prepare('UPDATE tasks SET auto_closed_at = ? WHERE uid = ?').run(new Date().toISOString(), uid)
}

const named = (title: string): boolean => title.trim() !== '' && title.trim() !== 'Untitled'

/** Writes `selfstudy: <uid>` into the note through the store's guarded save, building on the file as it is now. */
async function link(training: TrainingStore, ref: TrainingRef, uid: string): Promise<boolean> {
  for (let attempt = 0; attempt < LINK_ATTEMPTS; attempt++) {
    const file = await training.read(ref)
    // Someone linked it meanwhile (the page, or an earlier run): theirs stands.
    if (file.meta.selfStudy) return file.meta.selfStudy === uid
    const result = await training.save(ref, { meta: { selfStudy: uid } }, file.note.hash)
    if (result.status === 'saved') return true
  }
  return false
}

/**
 * Every Research training entry with a title and a date has its self-study task (the user's rule, 19 Oct 2026): made here, in the main
 * process, so it exists whether or not the note is ever opened. The task is a subtask under the series' `<series> self-study` task (a
 * top-level task in Training for an entry with no series), is due on the entry's date, follows its title and series, and is marked
 * done a week after the entry ends. Only for an entry made in the app (see `madeInApp`); older ones are the user's to map by hand. Idempotent: the uid is written into the note, and an entry that has one never gets a second. A
 * task the note names that is gone (the user deleted it) is not made again by itself. Returns whether any task changed.
 */
export async function settleSelfStudyTasks(options: SelfStudySweepOptions): Promise<boolean> {
  const { db, tasks, training, now, nowMs, quietMs = QUIET_MS } = options
  let changed = false
  let all = listTasks(db, 'research')
  const refresh = (): void => {
    all = listTasks(db, 'research')
    changed = true
  }

  const parentUid = (target: ParentTarget, made: string[]): string => {
    if ('uid' in target) return target.uid
    const parent = tasks.create({ workspace: 'research', title: target.title, list: target.list })
    made.push(parent.uid)
    return parent.uid
  }

  for (const row of listTrainingRows(db, 'research')) {
    if (!named(row.title) || !row.date) continue
    const ref: TrainingRef = { workspace: 'research', id: row.id }
    const file = await training.read(ref).catch(() => null)
    if (!file || nowMs - (file.note.edited ?? 0) < quietMs) continue
    const meta = file.meta
    if (!named(meta.title) || !meta.date) continue
    const note = {
      selfStudy: meta.selfStudy,
      series: meta.series,
      title: meta.title,
      date: meta.date
    }
    const session = { date: meta.date, end: meta.end }

    if (!meta.selfStudy) {
      const plan = planSelfStudyTask(note, all, true)
      if (plan.kind !== 'create') continue
      // Only a training made in the app (its `task:` is `auto`, or the task made for it carries the `training` marker). Every older
      // entry is left alone: the user maps those to tasks and hours by hand.
      const madeInApp =
        meta.task === 'auto' || all.find((t) => t.uid === meta.task)?.ownKind === 'training'
      if (!madeInApp) continue
      const made: string[] = []
      const task = tasks.create({
        workspace: 'research',
        title: plan.title,
        status: 'doing',
        ownKind: 'self-study',
        ...(plan.due ? { due: plan.due } : {}),
        ...(plan.parent ? { parentUid: parentUid(plan.parent, made) } : { list: TRAINING_LIST })
      })
      if (!(await link(training, ref, task.uid))) {
        // The note could not be written: take back what was just made, so the next run starts clean and nothing is doubled.
        tasks.delete(task.uid)
        for (const uid of made) tasks.delete(uid)
        refresh()
        continue
      }
      const changes = selfStudyTaskChanges(task, session, now)
      if (changes.done) {
        tasks.setStatus(task.uid, 'done')
        markClosed(db, task.uid)
      }
      refresh()
      continue
    }

    const own = all.find((t) => t.uid === meta.selfStudy)
    if (!own || !isSelfStudyOwn(own, all)) continue
    const plan = planSelfStudyTask(note, all)
    if (plan.kind === 'sync' && (plan.title !== undefined || plan.parent !== undefined)) {
      const made: string[] = []
      tasks.update(own.uid, {
        ...(plan.title !== undefined ? { title: plan.title } : {}),
        ...(plan.parent
          ? { parentUid: parentUid(plan.parent, made) }
          : plan.parent === null
            ? { parentUid: null, list: TRAINING_LIST }
            : {})
      })
      refresh()
    }
    const current: Task = tasks.get(own.uid) ?? own
    const changes = selfStudyTaskChanges(current, session, now)
    if (changes.due !== undefined) {
      tasks.setDue([current.uid], changes.due)
      refresh()
    }
    if (changes.done && !closedBefore(db, current.uid)) {
      tasks.setStatus(current.uid, 'done')
      markClosed(db, current.uid)
      refresh()
    }
  }
  return changed
}
