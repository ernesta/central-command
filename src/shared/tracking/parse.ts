import { dayNumber } from '../year'
import { timeToSeconds } from './rounding'
import { DEFAULT_PLAN, TIME_OFF_TYPES, emptyYear, type Plan, type TrackingYear } from './types'

type Obj = Record<string, unknown>

function isObj(value: unknown): value is Obj {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const isString = (v: unknown): v is string => typeof v === 'string'
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
const isDate = (v: unknown): v is string => isString(v) && dayNumber(v) !== null
const isTime = (v: unknown): v is string => isString(v) && timeToSeconds(v) !== null

/** A plan from untrusted input, or null when any field is out of range. Days are sorted and unique. */
export function parsePlan(raw: unknown): Plan | null {
  if (!isObj(raw)) return null
  const { hoursPerWeek, workDays, allowanceDays } = raw
  if (!isInt(hoursPerWeek) || hoursPerWeek <= 0 || hoursPerWeek > 7 * 24 * 60) return null
  if (!Array.isArray(workDays) || workDays.length === 0) return null
  if (!workDays.every((d) => isInt(d) && d >= 1 && d <= 7)) return null
  if (!isInt(allowanceDays) || allowanceDays < 0 || allowanceDays > 366) return null
  if (raw.weekAim !== undefined && typeof raw.weekAim !== 'boolean') return null
  if (raw.clients !== undefined) {
    const { clients } = raw
    if (!Array.isArray(clients) || clients.length > 20) return null
    if (!clients.every((c) => isString(c) && c.trim() !== '' && c === c.trim())) return null
    const lower = clients.map((c: string) => c.toLowerCase())
    if (new Set(lower).size !== lower.length) return null
  }
  return {
    ...raw,
    hoursPerWeek,
    workDays: [...new Set(workDays as number[])].sort((a, b) => a - b),
    allowanceDays
  } as Plan
}

function list(raw: unknown, ok: (item: Obj) => boolean): Obj[] | null {
  if (raw === undefined) return []
  if (!Array.isArray(raw) || !raw.every((item) => isObj(item) && ok(item))) return null
  return raw as Obj[]
}

function record(
  raw: unknown,
  ok: (key: string, value: Obj) => boolean
): Record<string, Obj> | null {
  if (raw === undefined) return {}
  if (!isObj(raw)) return null
  for (const [key, value] of Object.entries(raw)) if (!isObj(value) || !ok(key, value)) return null
  return raw as Record<string, Obj>
}

/**
 * A year's file from untrusted JSON, or null when it is not one (the caller sets such a file aside, it never
 * overwrites it). Missing parts take their defaults; a part of the wrong shape refuses the whole file rather than
 * being dropped, so nothing the user typed is silently lost. Keys this version does not know are kept, in the file
 * and inside every entry, so a newer or hand-edited file survives a save.
 */
export function parseYear(raw: unknown): TrackingYear | null {
  if (!isObj(raw) || raw.version !== 1) return null
  if (!isDate(raw.start)) return null
  const plan = raw.plan === undefined ? { ...DEFAULT_PLAN } : parsePlan(raw.plan)
  if (!plan) return null
  if (raw.weeks !== undefined && (!isInt(raw.weeks) || raw.weeks < 1 || raw.weeks > 156))
    return null
  const carryIn = raw.carryIn === undefined ? 0 : raw.carryIn
  if (typeof carryIn !== 'number' || !Number.isFinite(carryIn)) return null
  const sessions = list(
    raw.sessions,
    (s) =>
      isString(s.id) &&
      s.id !== '' &&
      isDate(s.date) &&
      isTime(s.start) &&
      (s.end === null || isTime(s.end)) &&
      (s.minutes === undefined || (isInt(s.minutes) && s.minutes >= 0)) &&
      isString(s.label) &&
      (s.task === undefined || isString(s.task)) &&
      (s.client === undefined || isString(s.client)) &&
      (s.earlier === undefined || s.earlier === true)
  )
  const adjusts = list(
    raw.adjusts,
    (a) =>
      isString(a.id) &&
      isDate(a.date) &&
      isString(a.label) &&
      isInt(a.minutes) &&
      (a.client === undefined || isString(a.client)) &&
      (a.task === undefined || isString(a.task)) &&
      (a.earlier === undefined || a.earlier === true)
  )
  const days = record(
    raw.days,
    (date, d) =>
      isDate(date) &&
      (d.minutes === undefined || (isInt(d.minutes) && d.minutes >= 0)) &&
      (d.note === undefined || isString(d.note))
  )
  const timeOff = list(
    raw.timeOff,
    (e) => isDate(e.date) && TIME_OFF_TYPES.some((t) => t.id === e.type)
  )
  const weekDays = raw.weekDays
  if (weekDays !== undefined) {
    if (!isObj(weekDays)) return null
    for (const [date, n] of Object.entries(weekDays))
      if (!isDate(date) || !isInt(n) || n < 0 || n > 7) return null
  }
  if (!sessions || !adjusts || !days || !timeOff) return null
  return {
    ...emptyYear(raw.start),
    ...raw,
    version: 1,
    start: raw.start,
    plan,
    carryIn,
    sessions,
    adjusts,
    days,
    timeOff,
    weekDays: (weekDays as Record<string, number> | undefined) ?? {}
  } as unknown as TrackingYear
}
