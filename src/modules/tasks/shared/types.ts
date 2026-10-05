/** Workspaces that can hold tasks (Research and Work each have their own list). */
export const TASK_WORKSPACES = ['research', 'work'] as const
export type TaskWorkspace = (typeof TASK_WORKSPACES)[number]

export const TASK_STATUSES = ['todo', 'doing', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ['high', 'normal', 'low'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const RECURRENCE_UNITS = ['day', 'week', 'month'] as const
export type RecurrenceUnit = (typeof RECURRENCE_UNITS)[number]

/** "Every N days, weeks or months", counted from the day the task is handled, not from its due date. */
export interface Recurrence {
  every: number
  unit: RecurrenceUnit
}

/** One task. A subtask has a `parentUid` and only one level exists: a subtask never has subtasks. */
export interface Task {
  /** The key mentions use (`cc://task/<uid>`). */
  uid: string
  workspace: TaskWorkspace
  title: string
  /** Markdown. */
  description: string
  status: TaskStatus
  priority: TaskPriority
  /** A date (YYYY-MM-DD), no time; null when the task has none. */
  due: string | null
  /** The moment the task was last marked done (ISO timestamp); null while it is open. */
  completedAt: string | null
  /** Required for a top-level task; a subtask is always '' (it shows its parent's). */
  list: string
  /** '' when there is none; only set together with a list. */
  sublist: string
  parentUid: string | null
  /** Where a subtask sits among its siblings. */
  position: number
  recurrence: Recurrence | null
  /** The first task of a recurring series; every later one carries the same value. */
  seriesUid: string | null
  /** The task's own time from ClickUp, in minutes. Shown, never written by the app. */
  earlierMinutes: number
  /** The ClickUp id, so a second import cannot duplicate. */
  sourceId: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

/** What a new task needs. */
export interface NewTask {
  workspace: TaskWorkspace
  title: string
  /** Required unless `parentUid` is given. */
  list?: string
  sublist?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  due?: string | null
  parentUid?: string | null
  recurrence?: Recurrence | null
  tags?: string[]
  /** Importer only. */
  earlierMinutes?: number
  sourceId?: string | null
  createdAt?: string
  completedAt?: string | null
  position?: number
}

/** The fields the app may change on an existing task (never `earlierMinutes` or `sourceId`). */
export interface TaskChanges {
  title?: string
  description?: string
  priority?: TaskPriority
  due?: string | null
  list?: string
  sublist?: string
  recurrence?: Recurrence | null
  tags?: string[]
}
