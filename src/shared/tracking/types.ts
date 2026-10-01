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
}

/** Typed time for a task on a day, signed, in multiples of 15 minutes. */
export interface Adjust {
  id: string
  date: string
  label: string
  minutes: number
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
}

/** The contents of one year's file for one workspace. */
export interface TrackingYear {
  version: 1
  /** A Monday; the year is 52 weeks from it. */
  start: string
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

export function emptyYear(start: string, plan: Plan = DEFAULT_PLAN, carryIn = 0): TrackingYear {
  return {
    version: 1,
    start,
    plan: { ...plan, workDays: [...plan.workDays] },
    carryIn,
    sessions: [],
    adjusts: [],
    days: {},
    timeOff: [],
    weekDays: {}
  }
}

/** A refused change says why; the caller shows nothing explanatory, it just does not change. */
export type Change = { ok: true; year: TrackingYear } | { ok: false; reason: string }
