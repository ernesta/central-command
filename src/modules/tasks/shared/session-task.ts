import type { Task } from './types'

/** A meeting or training as far as its task cares: the day, and when it ended (null: it has no end time). */
export interface SessionTimes {
  /** YYYY-MM-DD. */
  date: string
  /** 24-hour local HH:MM, or null. */
  end: string | null
}

/** Now in local time: the day (YYYY-MM-DD) and the time (HH:MM). */
export interface LocalMoment {
  date: string
  time: string
}

/**
 * Whether a session is over. A session with an end time is over once that time has passed; one with a date but no end time is
 * over when its day is (the user's choice, 17 Oct 2026). Without a date nothing is over.
 */
export function sessionOver(session: SessionTimes, now: LocalMoment): boolean {
  if (!session.date) return false
  if (session.date !== now.date) return session.date < now.date
  return session.end !== null && session.end <= now.time
}

export interface SessionTaskChanges {
  /** The day the task is due, when it is not already. */
  due?: string
  /** Mark the task done: its session is over and it is still open. */
  done?: boolean
}

/**
 * What a meeting's or training's own task needs from the clock and the note: due on the session's day, done once it is over.
 * Pure. A task that is done stays done and a task is never reopened here.
 */
export function sessionTaskChanges(
  task: Task,
  session: SessionTimes,
  now: LocalMoment
): SessionTaskChanges {
  const changes: SessionTaskChanges = {}
  if (!session.date) return changes
  if (task.due !== session.date) changes.due = session.date
  if (task.status !== 'done' && sessionOver(session, now)) changes.done = true
  return changes
}
