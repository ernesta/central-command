import type { Workspace } from '../settings'
import type { Plan, Session, TimeOffType, TrackingYear } from './types'

/** The one running timer of the whole app, with the file it lives in. */
export interface RunningTimer {
  workspace: Workspace
  /** The start of the year whose file holds the session. */
  year: string
  session: Session
}

/** The result of a change to one year: the year as saved, or why it was refused (nothing changes then). */
export type YearResult = { ok: true; year: TrackingYear } | { ok: false; reason: string }

/** The result of starting or stopping: the timer that runs afterwards (null when none does). */
export type TimerResult = { ok: true; running: RunningTimer | null } | { ok: false; reason: string }

export interface TrackingChangedEvent {
  workspace: Workspace
  year: string
}

/** Hours and Time off share one store; `year` is always a year's start date (a Monday). */
export interface TrackingApi {
  /** The years to offer for a workspace, newest first: every one with a file, plus the current one. */
  years(workspace: Workspace): Promise<string[]>
  /** One year's data. The current year is created on first read, with the previous year's plan and carry. */
  get(workspace: Workspace, year: string): Promise<TrackingYear>
  /** The running timer, wherever it is. */
  running(): Promise<RunningTimer | null>
  /** Start a task now; a running one stops at the same instant, even in another workspace. */
  start(workspace: Workspace, label: string, task?: string): Promise<TimerResult>
  stop(): Promise<TimerResult>
  /** Give a session left running on an earlier day its end time. */
  endAt(workspace: Workspace, year: string, id: string, time: string): Promise<TimerResult>
  deleteSession(workspace: Workspace, year: string, id: string): Promise<YearResult>
  setTaskMinutes(
    workspace: Workspace,
    year: string,
    date: string,
    label: string,
    minutes: number
  ): Promise<YearResult>
  /** Rename a task for one day (every block and typed time of it); a name already used that day merges the two. */
  renameTask(
    workspace: Workspace,
    year: string,
    date: string,
    from: string,
    to: string
  ): Promise<YearResult>
  addTime(
    workspace: Workspace,
    year: string,
    date: string,
    label: string,
    minutes: number
  ): Promise<YearResult>
  setNote(workspace: Workspace, year: string, date: string, note: string): Promise<YearResult>
  setPlan(workspace: Workspace, year: string, plan: Partial<Plan>): Promise<YearResult>
  addTimeOff(
    workspace: Workspace,
    year: string,
    from: string,
    to: string,
    type: TimeOffType
  ): Promise<YearResult>
  moveTimeOff(workspace: Workspace, year: string, from: string, to: string): Promise<YearResult>
  setTimeOffType(
    workspace: Workspace,
    year: string,
    date: string,
    type: TimeOffType
  ): Promise<YearResult>
  removeTimeOff(workspace: Workspace, year: string, date: string): Promise<YearResult>
  /** A year's file changed (any workspace). Returns an unsubscribe function. */
  onChanged(listener: (event: TrackingChangedEvent) => void): () => void
}

export const TRACKING_IPC = {
  years: 'tracking:years',
  get: 'tracking:get',
  running: 'tracking:running',
  start: 'tracking:start',
  stop: 'tracking:stop',
  endAt: 'tracking:end-at',
  deleteSession: 'tracking:delete-session',
  setTaskMinutes: 'tracking:set-task-minutes',
  renameTask: 'tracking:rename-task',
  addTime: 'tracking:add-time',
  setNote: 'tracking:set-note',
  setPlan: 'tracking:set-plan',
  addTimeOff: 'tracking:add-time-off',
  moveTimeOff: 'tracking:move-time-off',
  setTimeOffType: 'tracking:set-time-off-type',
  removeTimeOff: 'tracking:remove-time-off',
  changed: 'tracking:changed'
} as const
