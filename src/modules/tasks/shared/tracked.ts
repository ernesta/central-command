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
 */
export function trackedByTask(years: readonly TrackingYear[]): Map<string, number> {
  const minutes = new Map<string, number>()
  const add = (key: string | undefined, amount: number): void => {
    const uid = taskUidOf(key)
    if (uid && amount !== 0) minutes.set(uid, (minutes.get(uid) ?? 0) + amount)
  }
  for (const year of years) {
    for (const s of year.sessions) if (!s.earlier) add(s.task, reportedMinutes(s))
    for (const a of year.adjusts) if (!a.earlier) add(a.task, a.minutes)
  }
  return minutes
}

/**
 * The task a typed timer name stands for: the one open task whose title matches it (ignoring case and spaces), so choosing a
 * task by its name in Hours' Start field links the time to it. Null when none or several match (then it is just a name).
 */
export function taskKeyForLabel(
  tasks: readonly { uid: string; title: string }[],
  label: string
): string | undefined {
  const wanted = label.trim().toLowerCase()
  if (!wanted) return undefined
  const hits = tasks.filter((t) => t.title.trim().toLowerCase() === wanted)
  return hits.length === 1 ? taskKey(hits[0].uid) : undefined
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
