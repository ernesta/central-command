import type { Database } from 'better-sqlite3'
import { newUid } from '@shared/entities'
import { dayNumber } from '@shared/year'
import { isValidRecurrence, nextOccurrence } from '../shared/recurrence'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type NewTask,
  type Task,
  type TaskChanges,
  type TaskStatus
} from '../shared/types'
import {
  allUids,
  getTask,
  getTaskAnywhere,
  listSubtasks,
  markDeleted,
  markRestored,
  maxPosition,
  openInSeries,
  purge,
  writeTask
} from './repository'
import { listFor } from '../shared/work-lists'
import { seriesChanges, startedByKids } from '../shared/session-task'
import { normaliseTag } from '../shared/tag'
import { byPosition } from '../shared/views'

export interface Clock {
  /** Today in local time, YYYY-MM-DD. */
  today(): string
  /** Now as an ISO timestamp. */
  now(): string
}

export const systemClock: Clock = {
  today: () => {
    const d = new Date()
    const pad = (n: number): string => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  },
  now: () => new Date().toISOString()
}

/** The result of changing a status: the task, and the next occurrence when completing it started one. */
export interface StatusResult {
  task: Task
  next: Task | null
}

function cleanTags(tags: readonly string[] | undefined): string[] {
  return [...new Set((tags ?? []).map(normaliseTag).filter(Boolean))]
}

function checkDue(due: string | null | undefined): string | null {
  if (due === null || due === undefined || due === '') return null
  if (dayNumber(due) === null) throw new Error(`Not a date: ${due}`)
  return due
}

/**
 * Tasks in the database. Every change is one transaction. Nothing is deleted outright: a deleted task (with its
 * subtasks) keeps its row with `deleted_at` set, which is the trash, and can be restored. The one exception is
 * `discardIfEmpty`, for a task that was never written in.
 */
export class TasksStore {
  /**
   * `workClients` gives Work's clients; when it is set, a Work task's top-level list must be one of them (the rule of
   * `docs/CLIENT_LISTS_PLAN.md`, kept here so no caller can get round it). Left out, as in importers and scripts, any list goes.
   */
  constructor(
    private readonly db: Database,
    private readonly clock: Clock = systemClock,
    private readonly workClients?: () => readonly string[]
  ) {}

  /** The list to store for a top-level task, or an error when Work's rule refuses it. */
  private checkedList(workspace: Task['workspace'], list: string): string {
    if (!this.workClients) return list
    const clients = this.workClients()
    const allowed = listFor(workspace, list, clients)
    if (allowed === null) {
      throw new Error(
        `"${list}" is not a client, and Work's lists are its clients (${clients.join(', ') || 'none yet'})`
      )
    }
    return allowed
  }

  /** Create a task (or a subtask, with `parentUid`). Subtasks take their parent's workspace and have no list. */
  create(input: NewTask): Task {
    return this.db.transaction(() => this.insert(input))()
  }

  /** `ruled` is false for the next occurrence of a series and its subtasks, which keep the list they had. */
  private insert(input: NewTask, ruled = true): Task {
    const now = this.clock.now()
    const uids = allUids(this.db)
    let uid = newUid()
    while (uids.has(uid)) uid = newUid()

    let workspace = input.workspace
    let list = (input.list ?? '').trim()
    let sublist = list ? (input.sublist ?? '').trim() : ''
    let position = input.position ?? 0
    const parentUid = input.parentUid ?? null
    let due = input.due
    if (parentUid) {
      const parent = getTask(this.db, parentUid)
      if (!parent) throw new Error('The parent task does not exist')
      if (parent.parentUid) throw new Error('A subtask cannot have subtasks')
      if (input.recurrence) throw new Error('A subtask cannot repeat')
      workspace = parent.workspace
      if (due === undefined && ruled) due = parent.due
      list = ''
      sublist = ''
      if (input.position === undefined) position = maxPosition(this.db, parentUid) + 1
    } else if (!list) {
      throw new Error('A task needs a list')
    } else if (ruled) {
      list = this.checkedList(workspace, list)
    }
    if (input.recurrence && !isValidRecurrence(input.recurrence))
      throw new Error('Invalid repeat rule')
    const status = input.status ?? 'todo'
    if (!(TASK_STATUSES as readonly string[]).includes(status)) throw new Error('Invalid status')
    const priority = input.priority ?? 'normal'
    if (!(TASK_PRIORITIES as readonly string[]).includes(priority))
      throw new Error('Invalid priority')

    const task: Task = {
      uid,
      workspace,
      title: input.title.trim(),
      description: input.description ?? '',
      status,
      priority,
      due: checkDue(due),
      completedAt:
        status === 'done' ? (input.completedAt !== undefined ? input.completedAt : now) : null,
      list,
      sublist,
      parentUid,
      position,
      recurrence: input.recurrence ?? null,
      seriesUid: input.recurrence ? uid : null,
      earlierMinutes: Math.max(0, Math.round(input.earlierMinutes ?? 0)),
      sourceId: input.sourceId ?? null,
      tags: cleanTags(input.tags),
      ownKind: input.ownKind ?? null,
      watchItemId: input.watchItemId ?? null,
      watchUrl: input.watchUrl ?? null,
      createdAt: input.createdAt ?? now,
      updatedAt: now
    }
    writeTask(this.db, task)
    this.settleSeries(parentUid)
    return task
  }

  get(uid: string): Task | null {
    return getTask(this.db, uid)
  }

  /** Change fields of a task. A subtask keeps no list, and only a top-level task can repeat. */
  update(uid: string, changes: TaskChanges): Task {
    return this.db.transaction(() => {
      const task = this.require(uid)
      const next: Task = { ...task, updatedAt: this.clock.now() }
      if (changes.title !== undefined) next.title = changes.title.trim()
      if (changes.description !== undefined) next.description = changes.description
      if (changes.priority !== undefined) {
        if (!(TASK_PRIORITIES as readonly string[]).includes(changes.priority)) {
          throw new Error('Invalid priority')
        }
        next.priority = changes.priority
      }
      if (changes.due !== undefined) next.due = checkDue(changes.due)
      if (changes.tags !== undefined) next.tags = cleanTags(changes.tags)
      if (changes.ownKind !== undefined) next.ownKind = changes.ownKind
      if (changes.unlink) {
        next.watchItemId = null
        next.watchUrl = null
      }
      const promoting = changes.parentUid === null && task.parentUid !== null
      if (!promoting && (changes.list !== undefined || changes.sublist !== undefined)) {
        if (task.parentUid) throw new Error('A subtask has no list of its own')
        const list = (changes.list ?? task.list).trim()
        if (!list) throw new Error('A task needs a list')
        next.list =
          changes.list !== undefined && list !== task.list
            ? this.checkedList(task.workspace, list)
            : list
        next.sublist =
          changes.list !== undefined && changes.sublist === undefined
            ? ''
            : (changes.sublist ?? task.sublist).trim()
      }
      if (promoting) {
        const list = (changes.list ?? '').trim()
        if (!list) throw new Error('A task needs a list')
        next.parentUid = null
        next.list = this.checkedList(task.workspace, list)
        next.sublist = (changes.sublist ?? '').trim()
        next.position = 0
      } else if (
        changes.parentUid !== undefined &&
        changes.parentUid !== null &&
        changes.parentUid !== task.parentUid
      ) {
        const parent = getTask(this.db, changes.parentUid)
        if (!parent || parent.uid === uid) throw new Error('No such task')
        if (parent.parentUid) throw new Error('A subtask cannot have subtasks')
        if (parent.workspace !== task.workspace) throw new Error('A task stays in its workspace')
        if (!task.parentUid) {
          if (task.recurrence) throw new Error('A repeating task cannot become a subtask')
          if (listSubtasks(this.db, uid).length > 0) {
            throw new Error('A task with subtasks cannot become a subtask')
          }
          next.list = ''
          next.sublist = ''
        }
        next.parentUid = parent.uid
        next.position = maxPosition(this.db, parent.uid) + 1
      }
      if (changes.recurrence !== undefined) {
        if (changes.recurrence && task.parentUid) throw new Error('A subtask cannot repeat')
        if (changes.recurrence && !isValidRecurrence(changes.recurrence)) {
          throw new Error('Invalid repeat rule')
        }
        next.recurrence = changes.recurrence
        if (!changes.recurrence) next.seriesUid = null
        else if (!task.seriesUid) next.seriesUid = task.uid
      }
      writeTask(this.db, next)
      if (!task.parentUid) this.passDown(task, next.due)
      this.settleSeries(task.parentUid)
      if (next.parentUid !== task.parentUid) this.settleSeries(next.parentUid)
      return next
    })()
  }

  /** A parent that is given a due date gives it to the subtasks that have none; subtasks with a date keep it. */
  private passDown(before: Task, due: string | null): void {
    if (due === null || due === before.due) return
    for (const sub of listSubtasks(this.db, before.uid)) {
      if (sub.due === null) writeTask(this.db, { ...sub, due, updatedAt: this.clock.now() })
    }
  }

  /**
   * Change a task's status. Marking a recurring task done starts its next occurrence, due the interval after today
   * and with its subtasks copied, unless another instance of the series is already open (a series never has two).
   * Marking anything done sets `completedAt`; moving it back clears it. Marking a task done also marks its open
   * subtasks done (after the next occurrence is copied, so that one starts open).
   */
  setStatus(uid: string, status: TaskStatus): StatusResult {
    if (!(TASK_STATUSES as readonly string[]).includes(status)) throw new Error('Invalid status')
    return this.db.transaction(() => {
      const task = this.require(uid)
      const now = this.clock.now()
      const wasDone = task.status === 'done'
      // Done with no date gets today, for everything but the app's own session tasks (their status is the sweep's).
      const finishing = status === 'done' && !wasDone
      const updated: Task = {
        ...task,
        due: finishing && !task.due && !task.ownKind ? this.clock.today() : task.due,
        status,
        completedAt: status === 'done' ? (wasDone ? task.completedAt : now) : null,
        updatedAt: now
      }
      writeTask(this.db, updated)
      let next: Task | null = null
      if (status === 'done' && !wasDone && task.recurrence && !task.parentUid) {
        const seriesUid = task.seriesUid ?? task.uid
        if (openInSeries(this.db, seriesUid, task.uid) === 0) {
          const made = nextOccurrence(updated, listSubtasks(this.db, task.uid), this.clock.today())
          if (made) {
            next = this.insert(made.task, false)
            if (!task.seriesUid) writeTask(this.db, { ...updated, seriesUid })
            this.db
              .prepare('UPDATE tasks SET series_uid = ? WHERE uid = ?')
              .run(seriesUid, next.uid)
            next = { ...next, seriesUid }
            for (const sub of made.subtasks) this.insert({ ...sub, parentUid: next.uid }, false)
          }
        }
      }
      if (status === 'done' && !wasDone && !task.parentUid) {
        for (const sub of listSubtasks(this.db, task.uid)) {
          if (sub.status !== 'done') {
            writeTask(this.db, {
              ...sub,
              due: sub.due ?? (sub.ownKind ? null : this.clock.today()),
              status: 'done',
              completedAt: now,
              updatedAt: now
            })
          }
        }
      }
      this.settleSeries(task.parentUid)
      return { task: getTask(this.db, uid) as Task, next }
    })()
  }

  /** Today in local time, YYYY-MM-DD. */
  today(): string {
    return this.clock.today()
  }

  /** Set (or clear, with null) the due date of several tasks at once: "Move to Today" and "Move to Backlog". */
  setDue(uids: string[], due: string | null): void {
    const value = checkDue(due)
    this.db.transaction(() => {
      for (const uid of uids) {
        const task = this.require(uid)
        writeTask(this.db, { ...task, due: value, updatedAt: this.clock.now() })
        if (!task.parentUid) this.passDown(task, value)
        this.settleSeries(task.parentUid)
      }
    })()
  }

  /**
   * Put a subtask before another subtask of the same parent (null: at the end), in the user's own order. The siblings are
   * renumbered 1, 2, 3 …; only the ones whose number changed are written.
   */
  moveSubtask(uid: string, beforeUid: string | null): void {
    this.db.transaction(() => {
      const task = this.require(uid)
      if (!task.parentUid) throw new Error('Only a subtask can be moved')
      const siblings = listSubtasks(this.db, task.parentUid)
        .filter((k) => k.uid !== uid)
        .sort(byPosition)
      const at =
        beforeUid === null ? siblings.length : siblings.findIndex((k) => k.uid === beforeUid)
      if (at < 0) throw new Error('That subtask is not under the same task')
      siblings.splice(at, 0, task)
      const now = this.clock.now()
      siblings.forEach((k, i) => {
        if (k.position !== i + 1) writeTask(this.db, { ...k, position: i + 1, updatedAt: now })
      })
    })()
  }

  /** Put a task and its subtasks in the trash. */
  delete(uid: string): void {
    this.db.transaction(() => {
      const task = this.require(uid)
      const kids = listSubtasks(this.db, uid).map((k) => k.uid)
      markDeleted(this.db, [uid, ...kids], this.clock.now())
      this.settleSeries(task.parentUid)
    })()
  }

  /** Bring a deleted task back, with the subtasks that were deleted along with it. */
  restore(uid: string): Task {
    return this.db.transaction(() => {
      const found = getTaskAnywhere(this.db, uid)
      if (!found) throw new Error('No such task')
      const { task, deletedAt } = found
      if (deletedAt === null) return task
      if (task.parentUid && !getTask(this.db, task.parentUid)) {
        throw new Error('Restore the parent task first')
      }
      const kids = (
        this.db
          .prepare('SELECT uid FROM tasks WHERE parent_uid = ? AND deleted_at = ?')
          .all(uid, deletedAt) as { uid: string }[]
      ).map((r) => r.uid)
      markRestored(this.db, [uid, ...kids], this.clock.now())
      this.settleSeries(task.parentUid)
      return getTask(this.db, uid) as Task
    })()
  }

  /**
   * Remove a task that was never written in (no title, no description, no time, no subtasks) for real, because
   * nothing is lost. Resolves with whether it was removed.
   */
  discardIfEmpty(uid: string): boolean {
    return this.db.transaction(() => {
      const task = getTask(this.db, uid)
      if (!task) return false
      const untouched =
        task.title === '' &&
        task.description.trim() === '' &&
        task.earlierMinutes === 0 &&
        task.sourceId === null &&
        task.tags.length === 0 &&
        listSubtasks(this.db, uid).length === 0
      if (!untouched) return false
      purge(this.db, uid)
      return true
    })()
  }

  /**
   * Keeps a series task (what meetings or trainings sit under) in step with its subtasks: the latest of their due dates, Done once
   * they all are, open again when one is added or reopened (`seriesChanges`). Called after every change to a subtask, and by the
   * sweep. Returns whether the series changed.
   */
  settleSeries(uid: string | null | undefined): boolean {
    if (!uid) return false
    const series = getTask(this.db, uid)
    if (!series) return false
    const kids = listSubtasks(this.db, uid)
    const changes = seriesChanges(series, kids)
    if (changes.status === undefined && startedByKids(series, kids)) changes.status = 'doing'
    if (changes.due === undefined && changes.status === undefined) return false
    const now = this.clock.now()
    const next: Task = { ...series, updatedAt: now }
    if (changes.due !== undefined) next.due = changes.due
    if (changes.status !== undefined) {
      next.status = changes.status
      next.completedAt = changes.status === 'done' ? now : null
    }
    writeTask(this.db, next)
    return true
  }

  private require(uid: string): Task {
    const task = getTask(this.db, uid)
    if (!task) throw new Error('No such task')
    return task
  }
}
