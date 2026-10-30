import type {
  OwnKind,
  Recurrence,
  Task,
  TaskChanges,
  TaskPriority,
  TaskStatus,
  TaskWorkspace
} from './types'
import type { SessionSource } from './session-lock'
import type { WatchTaskLink } from './watch-links'

/** What the app may ask for when it creates a task: nothing the importer alone sets. */
export interface CreateTaskInput {
  workspace: TaskWorkspace
  title: string
  /** Required unless `parentUid` is given. */
  list?: string
  sublist?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  /** YYYY-MM-DD, or null for none. */
  due?: string | null
  parentUid?: string | null
  recurrence?: Recurrence | null
  tags?: string[]
  /** Set by the page that makes a meeting's or training's task, so the app knows it is the session's own. */
  ownKind?: OwnKind | null
  /** Set by the New task dialog when it was opened from a Watch row (`docs/WATCH_TASKS_PLAN.md`). */
  watchItemId?: number | null
  watchUrl?: string | null
}

/** The result of changing a task's status: the next occurrence of a recurring task, when completing it started one. */
export interface TaskStatusResult {
  task: Task
  next: Task | null
}

/** Pushed to the renderer after every change to the tasks, so every open page refreshes. */
export interface TasksChangedEvent {
  workspace: TaskWorkspace
}

/** The Tasks slice of window.api. */
export interface TasksApi {
  /** Every task of a workspace that is not in the trash, subtasks included. */
  list(workspace: TaskWorkspace): Promise<Task[]>
  get(uid: string): Promise<Task | null>
  /**
   * The top-level lists a workspace allows: in Work its clients (every client of every contract, once each); null in Research,
   * whose lists are free.
   */
  clients(workspace: TaskWorkspace): Promise<string[] | null>
  create(input: CreateTaskInput): Promise<Task>
  update(uid: string, changes: TaskChanges): Promise<Task>
  setStatus(uid: string, status: TaskStatus): Promise<TaskStatusResult>
  /** Set (or clear, with null) the due date of several tasks at once. */
  setDue(uids: string[], due: string | null): Promise<void>
  /** Put a subtask before another subtask of the same task (null: last). Session tasks keep their date order. */
  moveSubtask(uid: string, beforeUid: string | null): Promise<void>
  /**
   * Move a task and its subtasks to the trash. Their saved time leaves Hours with them (kept for a restore); resolves with
   * the minutes removed. The caller asks the user first, unless the task is untouched.
   */
  delete(uid: string): Promise<number>
  /** The minutes of saved time deleting the task (and its subtasks) would remove from Hours. */
  timeOn(uid: string): Promise<number>
  /** Bring a deleted task back, with the subtasks deleted with it. */
  restore(uid: string): Promise<Task>
  /** Remove a task nobody wrote in, for real. Resolves with whether it was removed. */
  discardIfEmpty(uid: string): Promise<boolean>
  /** Deleted tasks that can be brought back (a task deleted with its parent comes back with it), newest first. */
  trash(): Promise<{ task: Task; deletedAt: string }[]>
  /** Write a readable copy of every task now (the app also writes one a day). Resolves with the file's name. */
  snapshot(): Promise<string>
  /**
   * The uids of the workspace's session tasks: a meeting's own task and a training's own task. Hours does not offer them
   * (their time is typed in the note); a task the user chose for a meeting is not one.
   */
  sessionTaskUids(workspace: TaskWorkspace): Promise<string[]>
  /**
   * What a meeting's or training's note does to its own task (title, date, series task), which the user cannot do by hand
   * (`update` refuses those on a session task). Only the notes' sync calls it.
   */
  updateForSession(uid: string, changes: TaskChanges): Promise<Task>
  /** Trash a session task as its note's sync does (`delete` refuses one). Resolves with the minutes removed. */
  deleteForSession(uid: string): Promise<number>
  /** The meeting or training whose note made this task, for the line on a locked task; null for any other. */
  sessionSource(uid: string): Promise<SessionSource | null>
  /**
   * For each Watch item of a workspace that has a task made from it, the task (an open one first), for the Watch rows. Tasks in the
   * trash are left out. Kept fresh by `onChanged`.
   */
  watchLinks(workspace: TaskWorkspace): Promise<WatchTaskLink[]>
  /** Subscribe to changes. Returns an unsubscribe function. */
  onChanged(listener: (event: TasksChangedEvent) => void): () => void
}

export const TASKS_IPC = {
  list: 'tasks:list',
  get: 'tasks:get',
  clients: 'tasks:clients',
  create: 'tasks:create',
  update: 'tasks:update',
  setStatus: 'tasks:set-status',
  setDue: 'tasks:set-due',
  moveSubtask: 'tasks:move-subtask',
  delete: 'tasks:delete',
  timeOn: 'tasks:time-on',
  restore: 'tasks:restore',
  trash: 'tasks:trash',
  snapshot: 'tasks:snapshot',
  sessionTaskUids: 'tasks:session-task-uids',
  discardIfEmpty: 'tasks:discard-if-empty',
  updateForSession: 'tasks:update-for-session',
  deleteForSession: 'tasks:delete-for-session',
  sessionSource: 'tasks:session-source',
  watchLinks: 'tasks:watch-links',
  changed: 'tasks:changed'
} as const
