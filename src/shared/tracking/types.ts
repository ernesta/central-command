/** Kinds of time off. Fixed: there is no types setting. */
export type TimeOffType = 'public' | 'university' | 'leave'

export const TIME_OFF_TYPES: readonly { id: TimeOffType; label: string }[] = [
  { id: 'public', label: 'Public holiday' },
  { id: 'university', label: 'University holiday' },
  { id: 'leave', label: 'Annual leave' }
]

/** One block of work on one task, on one day. A session never crosses midnight. */
export interface Session {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** HH:MM:SS, kept to the second so nothing drifts. */
  start: string
  /** HH:MM:SS, or null while it runs. */
  end: string | null
  /** Reported time: a multiple of 15, frozen when the session ended. Absent while it runs. */
  minutes?: number
  label: string
  /** An entity key (`cc://task/<uid>`) once Tasks exist. */
  task?: string
  /** Who the time is for: one of the plan's clients (Work only; Research has none). */
  client?: string
  /** The task's ClickUp time was raised to cover this session, so Tasks does not add it again (see `Adjust.earlier`). */
  earlier?: true
}

/** Typed time for a task on a day, signed, in multiples of 15 minutes. */
export interface Adjust {
  id: string
  date: string
  label: string
  minutes: number
  client?: string
  /** The task the time is for (`cc://task/<uid>`), when it was added from a task's page. */
  task?: string
  /**
   * Set on imported history that was linked to its task afterwards: the time is already in the task's ClickUp time, so Tasks
   * does not add it again. Hours counts it like any other time.
   */
  earlier?: true
}

/** Imported history: a typed total for a day, and a loose note. */
export interface DayEntry {
  minutes?: number
  note?: string
}

export interface TimeOffEntry {
  date: string
  type: TimeOffType
}

export interface Plan {
  /** Minutes a week: 2250 is 37:30. */
  hoursPerWeek: number
  /** Days worked, Monday = 1 to Sunday = 7. */
  workDays: number[]
  allowanceDays: number
  /** The whole week's hours are aimed at from its first day (a balance of minus the week's hours), not a share a day. */
  weekAim?: boolean
  /**
   * The clients time can be for, in the order shown (Work: Impact, Teaching & Learning). Where there are none (Research),
   * entries carry no client and nothing about clients is shown.
   */
  clients?: string[]
}

/** The period a contract is invoiced for. */
export type Invoice = 'week' | 'month'

export const INVOICES: readonly Invoice[] = ['week', 'month']

/** What a new contract is for; whatever is left out comes from the workspace's default plan. */
export interface ContractTerms {
  name?: string
  clients?: string[]
  /** Minutes a week; 0 is no fixed hours. */
  weeklyMinutes?: number
  invoice?: Invoice
}

/** How a year is invoiced: files from before the field read as monthly. */
export function invoiceOf(year: Pick<TrackingYear, 'invoice'>): Invoice {
  return year.invoice ?? 'month'
}

/** The contents of one year's file for one workspace. */
export interface TrackingYear {
  version: 1
  /** A Monday (any weekday for a Work contract); the year is 52 weeks from it, or `weeks`. */
  start: string
  /** The length in weeks when it is not 52: a Work contract. */
  weeks?: number
  /** A Work contract's name (Luminos, Research Assistant), shown with its dates. */
  name?: string
  /** How a Work contract is invoiced; absent reads as `month`. */
  invoice?: Invoice
  plan: Plan
  /** Seconds: the previous year's final rounding carry. */
  carryIn: number
  sessions: Session[]
  adjusts: Adjust[]
  days: Record<string, DayEntry>
  timeOff: TimeOffEntry[]
  /** Imported history only: planned days typed in the old sheet, by week start. */
  weekDays: Record<string, number>
}

/** The local date and time of "now", supplied by the caller so every rule is a pure function. */
export interface Moment {
  date: string
  /** HH:MM:SS */
  time: string
}

export const DEFAULT_PLAN: Plan = {
  hoursPerWeek: 2250,
  workDays: [1, 2, 3, 4, 5],
  allowanceDays: 40
}

/** Work: eight hours a week worked in bursts on any day, aimed at over the week, and no time off. */
export const WORK_PLAN: Plan = {
  hoursPerWeek: 480,
  workDays: [1, 2, 3, 4, 5, 6, 7],
  allowanceDays: 0,
  weekAim: true,
  clients: ['Impact', 'Teaching & Learning']
}

/** The plan a workspace's first year starts from. */
export function defaultPlan(workspace: string): Plan {
  return workspace === 'work' ? WORK_PLAN : DEFAULT_PLAN
}

export function emptyYear(start: string, plan: Plan = DEFAULT_PLAN, carryIn = 0): TrackingYear {
  return {
    version: 1,
    start,
    plan: {
      ...plan,
      workDays: [...plan.workDays],
      ...(plan.clients ? { clients: [...plan.clients] } : {})
    },
    carryIn,
    sessions: [],
    adjusts: [],
    days: {},
    timeOff: [],
    weekDays: {}
  }
}

/** A refused change says why; the caller shows nothing explanatory, it just does not change. */
/** A client that cannot go because its Tasks list still holds tasks. */
export interface ClientHoldsTasks {
  client: string
  tasks: number
}

export type Change =
  | { ok: true; year: TrackingYear }
  | { ok: false; reason: string; detail?: ClientHoldsTasks }
