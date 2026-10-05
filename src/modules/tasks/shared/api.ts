import type {
  Recurrence,
  Task,
  TaskChanges,
  TaskPriority,
  TaskStatus,
  TaskWorkspace
} from './types'

/** What the app may ask for when it creates a task: nothing the importer alone sets. */
export interface CreateTaskInput {
  workspace: TaskWorkspace
  title: string
  /** Required unless `parentUid` is given. */
  list?: string
  sublist?: string
  description?: string
  priority?: TaskPriority
  /** YYYY-MM-DD, or null for none. */
  due?: string | null
  parentUid?: string | null
  recurrence?: Recurrence | null
  tags?: string[]
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
  create(input: CreateTaskInput): Promise<Task>
  update(uid: string, changes: TaskChanges): Promise<Task>
  setStatus(uid: string, status: TaskStatus): Promise<TaskStatusResult>
  /** Set (or clear, with null) the due date of several tasks at once. */
  setDue(uids: string[], due: string | null): Promise<void>
  /** Move a task and its subtasks to the trash. The caller asks the user first, unless the task is untouched. */
  delete(uid: string): Promise<void>
  /** Bring a deleted task back, with the subtasks deleted with it. */
  restore(uid: string): Promise<Task>
  /** Remove a task nobody wrote in, for real. Resolves with whether it was removed. */
  discardIfEmpty(uid: string): Promise<boolean>
  /** Deleted tasks that can be brought back (a task deleted with its parent comes back with it), newest first. */
  trash(): Promise<{ task: Task; deletedAt: string }[]>
  /** Write a readable copy of every task now (the app also writes one a day). Resolves with the file's name. */
  snapshot(): Promise<string>
  /** Subscribe to changes. Returns an unsubscribe function. */
  onChanged(listener: (event: TasksChangedEvent) => void): () => void
}

export const TASKS_IPC = {
  list: 'tasks:list',
  get: 'tasks:get',
  create: 'tasks:create',
  update: 'tasks:update',
  setStatus: 'tasks:set-status',
  setDue: 'tasks:set-due',
  delete: 'tasks:delete',
  restore: 'tasks:restore',
  trash: 'tasks:trash',
  snapshot: 'tasks:snapshot',
  discardIfEmpty: 'tasks:discard-if-empty',
  changed: 'tasks:changed'
} as const
