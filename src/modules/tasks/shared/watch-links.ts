import type { Task, TaskStatus } from './types'

/** What a Watch row needs to know about the task made from its item (`docs/WATCH_TASKS_PLAN.md`). */
export interface WatchTaskLink {
  itemId: number
  uid: string
  title: string
  status: TaskStatus
}

/**
 * One link per Watch item from the tasks that name one (trash already left out). An open task wins over a done one, so a second
 * task cannot be offered while one is open; among the same kind the latest made wins. The store lets an item have several tasks;
 * this is where one is picked.
 */
export function watchLinks(tasks: readonly Task[]): WatchTaskLink[] {
  const best = new Map<number, Task>()
  for (const t of tasks) {
    if (t.watchItemId === null) continue
    const held = best.get(t.watchItemId)
    if (!held || rank(t) > rank(held)) best.set(t.watchItemId, t)
  }
  return [...best.entries()].map(([itemId, t]) => ({
    itemId,
    uid: t.uid,
    title: t.title,
    status: t.status
  }))
}

const rank = (t: Task): string => `${t.status === 'done' ? '0' : '1'}${t.createdAt}${t.uid}`

/** The ids of the Watch items that have an open (not done) task: what Home leaves out of its own list. */
export function openWatchItemIds(tasks: readonly Task[]): Set<number> {
  return new Set(
    tasks.flatMap((t) => (t.watchItemId !== null && t.status !== 'done' ? [t.watchItemId] : []))
  )
}
