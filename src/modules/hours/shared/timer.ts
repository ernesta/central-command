import { timeToSeconds } from '@shared/tracking/rounding'
import type { Moment, Session } from '@shared/tracking/types'

/**
 * Whole minutes since a running session started: the chip's clock, the one place exact time is shown. Null when
 * the session is from an earlier day (it waits for an end time and has no clock).
 */
export function elapsedMinutes(session: Session, now: Moment): number | null {
  if (session.date !== now.date) return null
  const a = timeToSeconds(session.start)
  const b = timeToSeconds(now.time)
  return a === null || b === null ? null : Math.max(0, Math.floor((b - a) / 60))
}
