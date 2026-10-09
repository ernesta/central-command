import type { Workspace } from '../settings'
import type { OpenContracts } from './contracts'
import type { Change, ContractTerms, Plan, Session, TimeOffType, TrackingYear } from './types'

/** The one running timer of the whole app, with the file it lives in. */
export interface RunningTimer {
  workspace: Workspace
  /** The start of the year whose file holds the session. */
  year: string
  session: Session
}

/** The result of a change to one year: the year as saved, or why it was refused (nothing changes then). */
export type YearResult = Change

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
  /** The contracts that hold today with their clients: what a timer can start for (Work; Research has none). */
  openContracts(workspace: Workspace): Promise<OpenContracts>
  /** Start a task now, in the contract of its client (the one of the client used last when none is given); a running one stops at the same instant, even in another workspace. */
  start(workspace: Workspace, label: string, task?: string, client?: string): Promise<TimerResult>
  stop(): Promise<TimerResult>
  /** Give a session left running on an earlier day its end time. */
  endAt(workspace: Workspace, year: string, id: string, time: string): Promise<TimerResult>
  /** Change when the running timer started (today, not after now); an earlier entry it overlaps is trimmed. */
  setStart(workspace: Workspace, year: string, id: string, time: string): Promise<TimerResult>
  /** Give the running timer its task: its name, key and client (the task's list) become the timer's. */
  assignTask(
    workspace: Workspace,
    year: string,
    id: string,
    label: string,
    task: string,
    client?: string
  ): Promise<TimerResult>
  deleteSession(workspace: Workspace, year: string, id: string): Promise<YearResult>
  /** Delete a task's saved time for one day (its ended sessions and typed time); a running timer and linked history stay. */
  deleteTaskTime(
    workspace: Workspace,
    year: string,
    date: string,
    label: string,
    client?: string
  ): Promise<YearResult>
  setTaskMinutes(
    workspace: Workspace,
    year: string,
    date: string,
    label: string,
    minutes: number,
    client?: string
  ): Promise<YearResult>
  /** Rename a task for one day (every block and typed time of it); a name already used that day merges the two. */
  renameTask(
    workspace: Workspace,
    year: string,
    date: string,
    from: string,
    to: string,
    client?: string
  ): Promise<YearResult>
  /** Change the client of a task for one day (`from` is its client now, none for older time); the new one is on the plan's list. */
  setClient(
    workspace: Workspace,
    year: string,
    date: string,
    label: string,
    from: string | undefined,
    to: string
  ): Promise<YearResult>
  addTime(
    workspace: Workspace,
    year: string,
    date: string,
    label: string,
    minutes: number,
    client?: string,
    /** The task (`cc://task/<uid>`) the time is for. */
    task?: string
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
  editTimeOff(
    workspace: Workspace,
    year: string,
    from: string,
    to: string,
    type: TimeOffType
  ): Promise<YearResult>
  removeTimeOff(workspace: Workspace, year: string, date: string): Promise<YearResult>
  /** Start a Work contract from its first to its last day (whole weeks from its first day). */
  createContract(
    workspace: Workspace,
    start: string,
    end: string,
    terms?: ContractTerms
  ): Promise<YearResult>
  /** Rename a Work client: its Tasks list and tasks, and its name in every contract and entry that has it. */
  renameClient(
    workspace: Workspace,
    from: string,
    to: string
  ): Promise<{ ok: true } | { ok: false; reason: string }>
  /** Move a contract's last day. */
  setContractEnd(workspace: Workspace, year: string, end: string): Promise<YearResult>
  /** A year's file changed (any workspace). Returns an unsubscribe function. */
  onChanged(listener: (event: TrackingChangedEvent) => void): () => void
}

export const TRACKING_IPC = {
  years: 'tracking:years',
  get: 'tracking:get',
  running: 'tracking:running',
  openContracts: 'tracking:open-contracts',
  start: 'tracking:start',
  stop: 'tracking:stop',
  endAt: 'tracking:end-at',
  setStart: 'tracking:set-start',
  assignTask: 'tracking:assign-task',
  deleteSession: 'tracking:delete-session',
  deleteTaskTime: 'tracking:delete-task-time',
  setTaskMinutes: 'tracking:set-task-minutes',
  renameTask: 'tracking:rename-task',
  setClient: 'tracking:set-client',
  addTime: 'tracking:add-time',
  setNote: 'tracking:set-note',
  setPlan: 'tracking:set-plan',
  addTimeOff: 'tracking:add-time-off',
  editTimeOff: 'tracking:edit-time-off',
  removeTimeOff: 'tracking:remove-time-off',
  createContract: 'tracking:create-contract',
  renameClient: 'tracking:rename-client',
  setContractEnd: 'tracking:set-contract-end',
  changed: 'tracking:changed'
} as const
