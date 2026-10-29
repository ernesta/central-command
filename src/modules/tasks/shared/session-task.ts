import { addDays } from '@shared/year'
import type { Task, TaskStatus } from './types'

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

/** How long after a training ends its self-study task is marked done (the user's rule, 19 Oct 2026): a week, to the minute. */
export const SELF_STUDY_DONE_AFTER_DAYS = 7

/** The time of day a training with no end time is taken to end (the end of its day). */
export const END_OF_DAY = '23:59'

/** The day a training's self-study task is due (the user's rule, 23 Oct 2026): the moment it is done, a week after the training. */
export const selfStudyDue = (date: string): string => addDays(date, SELF_STUDY_DONE_AFTER_DAYS)

/**
 * The moment a training's self-study task is done: `SELF_STUDY_DONE_AFTER_DAYS` after its date, at its end time (the end of the day
 * when it has none). Null without a date.
 */
export function selfStudyDoneAt(session: SessionTimes): LocalMoment | null {
  if (!session.date) return null
  return {
    date: addDays(session.date, SELF_STUDY_DONE_AFTER_DAYS),
    time: session.end ?? END_OF_DAY
  }
}

/**
 * What a training's self-study task needs from the clock and the note: due a week after the training (`selfStudyDue`), done at that
 * moment, the training's end time that day (at that minute, not the one before). Pure. A done task stays done and is never reopened here; like `sessionTaskChanges`, an
 * open one that is past its moment is closed again on the next run.
 */
export function selfStudyTaskChanges(
  task: Task,
  session: SessionTimes,
  now: LocalMoment
): SessionTaskChanges {
  const changes: SessionTaskChanges = {}
  const doneAt = selfStudyDoneAt(session)
  if (!doneAt) return changes
  if (task.due !== doneAt.date) changes.due = doneAt.date
  const reached = now.date !== doneAt.date ? now.date > doneAt.date : now.time >= doneAt.time
  if (task.status !== 'done' && reached) changes.done = true
  return changes
}

/** A to-do task whose subtask is in progress or done has been started (the user's rule, 29 Oct 2026). Pure. */
export function startedByKids(task: Task, kids: readonly Task[]): boolean {
  return !task.parentUid && task.status === 'todo' && kids.some((k) => k.status !== 'todo')
}

export interface SeriesChanges {
  due?: string | null
  status?: TaskStatus
}

/**
 * What a series task (the top-level task meetings or trainings sit under) needs from its subtasks (the user's rule, 23 Oct 2026):
 * its due date is the latest of theirs, and it is done once all of them are done, and open again (In progress) when one is added or
 * reopened. Pure. A task with no session subtask is no series and needs nothing; a series with no subtask left stays as it is.
 */
export function seriesChanges(series: Task, kids: readonly Task[]): SeriesChanges {
  const changes: SeriesChanges = {}
  if (series.parentUid || !kids.some((k) => k.ownKind)) return changes
  const dates = kids.map((k) => k.due).filter((d): d is string => d !== null)
  const latest = dates.length > 0 ? dates.reduce((a, b) => (b > a ? b : a)) : null
  if (series.due !== latest) changes.due = latest
  const allDone = kids.every((k) => k.status === 'done')
  if (allDone && series.status !== 'done') changes.status = 'done'
  else if (!allDone && series.status === 'done') changes.status = 'doing'
  return changes
}
