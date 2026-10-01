import type { Session, TrackingYear } from './types'

/** Reported time is always a whole number of quarter hours. */
export const QUARTER = 15

/** HH:MM:SS (or HH:MM) as seconds since midnight; null when it is not a time of day. */
export function timeToSeconds(time: string): number | null {
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time)
  if (!m) return null
  const [h, min, s] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)]
  return h < 24 && min < 60 && s < 60 ? h * 3600 + min * 60 + s : null
}

/** Seconds, to the nearest quarter hour in minutes, halves up, never negative. */
export function roundToQuarter(seconds: number): number {
  return Math.max(0, Math.floor((seconds + (QUARTER * 60) / 2) / (QUARTER * 60)) * QUARTER)
}

/** The exact length of an ended session in seconds; 0 when it has no end or the end is not after the start. */
export function exactSeconds(session: Session): number {
  if (session.end === null) return 0
  const a = timeToSeconds(session.start)
  const b = timeToSeconds(session.end)
  return a === null || b === null || b <= a ? 0 : b - a
}

/** What an ended session reports: its frozen minutes (rounded on the spot only for a file that never had them). */
export function reportedMinutes(session: Session): number {
  if (session.end === null) return 0
  return session.minutes ?? roundToQuarter(exactSeconds(session))
}

/**
 * The exact time not yet reported, in seconds: `carryIn + Σ (exact − reported)` over every ended session. It is
 * always derived from the stored minutes and never stored, so there is one truth.
 */
export function carrySeconds(year: TrackingYear): number {
  let carry = year.carryIn
  for (const s of year.sessions) {
    if (s.end === null || s.minutes === undefined) continue
    carry += exactSeconds(s) - s.minutes * 60
  }
  return carry
}

/** The minutes a session of `exact` seconds would report if it ended now, given the carry so far. */
export function reportFor(carry: number, exact: number): number {
  return roundToQuarter(carry + exact)
}

/**
 * What a running session shows until it ends: its own length to the nearest quarter hour, provisional, nothing
 * stored. The carry from earlier sessions is deliberately left out; it is applied once, when the session ends, so
 * a task just started never shows time borrowed from or lent to the one before.
 */
export function provisionalMinutes(session: Session, time: string): number {
  if (session.end !== null) return reportedMinutes(session)
  const a = timeToSeconds(session.start)
  const b = timeToSeconds(time)
  return roundToQuarter(a === null || b === null || b <= a ? 0 : b - a)
}
