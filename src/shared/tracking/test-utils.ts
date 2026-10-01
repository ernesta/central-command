import { emptyYear, type Change, type Moment, type TrackingYear } from './types'

export const START = '2026-09-21'

export function year(overrides: Partial<TrackingYear> = {}): TrackingYear {
  return { ...emptyYear(START), ...overrides }
}

export function at(date: string, time: string): Moment {
  return { date, time }
}

/** The new year of a change that must succeed. */
export function ok(change: Change): TrackingYear {
  if (!change.ok) throw new Error(`Refused: ${change.reason}`)
  return change.year
}

let counter = 0
export function nextId(): string {
  return `id${++counter}`
}
