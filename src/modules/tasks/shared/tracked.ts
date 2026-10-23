import { reportedMinutes } from '@shared/tracking/rounding'
import type { TrackingYear } from '@shared/tracking/types'

const PREFIX = 'cc://task/'

/** The key a session or typed time carries for a task. */
export function taskKey(uid: string): string {
  return `${PREFIX}${uid}`
}

/** The task a key names, or null for any other value. */
export function taskUidOf(key: string | undefined): string | null {
  return key !== undefined && key.startsWith(PREFIX) && key.length > PREFIX.length
    ? key.slice(PREFIX.length)
    : null
}

/**
 * The minutes Hours holds for each task (by uid), from every year given: the reported time of each ended session that names
 * the task, plus time typed for it (not history marked `earlier`: ClickUp's time already holds it). A running session is not counted here (the page adds its whole minutes). ClickUp's
 * earlier time is the task's own `earlierMinutes`, never part of this.
 *
 * With `earlierMinutes` (each task's own, by uid), history marked `earlier` that the task's ClickUp time does NOT hold is counted too:
 * the mark says "ClickUp's time was raised to cover this", and a task the app made after the import (PS5210's "Introduction", whose
 * 2:00 `link:ps5210` linked) was never raised, so its page showed none of the time Hours holds against it. Callers that add the
 * task's `earlierMinutes` themselves (a task's time) pass it; the training log's own sum does not.
 */
export function trackedByTask(
  years: readonly TrackingYear[],
  earlierMinutes?: ReadonlyMap<string, number>
): Map<string, number> {
  const minutes = new Map<string, number>()
  const add = (key: string | undefined, amount: number): void => {
    const uid = taskUidOf(key)
    if (uid && amount !== 0) minutes.set(uid, (minutes.get(uid) ?? 0) + amount)
  }
  for (const year of years) {
    for (const s of year.sessions) if (!s.earlier) add(s.task, reportedMinutes(s))
    for (const a of year.adjusts) if (!a.earlier) add(a.task, a.minutes)
  }
  if (earlierMinutes) {
    const marked = new Map<string, number>()
    const mark = (key: string | undefined, amount: number): void => {
      const uid = taskUidOf(key)
      if (uid && amount !== 0) marked.set(uid, (marked.get(uid) ?? 0) + amount)
    }
    for (const year of years) {
      for (const s of year.sessions)
        if (s.earlier && s.end !== null) mark(s.task, reportedMinutes(s))
      for (const a of year.adjusts) if (a.earlier) mark(a.task, a.minutes)
    }
    for (const [uid, held] of marked) {
      const shortfall = held - (earlierMinutes.get(uid) ?? 0)
      if (shortfall > 0) minutes.set(uid, (minutes.get(uid) ?? 0) + shortfall)
    }
  }
  return minutes
}

/**
 * Every hour Hours holds for a task by month (`YYYY-MM`, oldest first): ended sessions and typed time, history linked to the task
 * included (which `trackedByTask` leaves out because ClickUp's time already holds it). For the task page's "by month" list.
 */
export function hoursByMonth(
  years: readonly TrackingYear[],
  uid: string
): { month: string; minutes: number }[] {
  const months = new Map<string, number>()
  const add = (key: string | undefined, date: string, amount: number): void => {
    if (taskUidOf(key) === uid && amount !== 0)
      months.set(date.slice(0, 7), (months.get(date.slice(0, 7)) ?? 0) + amount)
  }
  for (const year of years) {
    for (const s of year.sessions) add(s.task, s.date, s.end === null ? 0 : reportedMinutes(s))
    for (const a of year.adjusts) add(a.task, a.date, a.minutes)
  }
  return [...months]
    .map(([month, minutes]) => ({ month, minutes }))
    .sort((a, b) => a.month.localeCompare(b.month))
}
