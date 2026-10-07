import { fold } from '@shared/text'
import type { OpenContract } from '@shared/tracking/contracts'
import type { TrackingYear } from '@shared/tracking/types'
import { addDays } from '@shared/year'
import { listForNewTask } from '../../tasks/shared/new-task-list'
import { taskUidOf } from '../../tasks/shared/tracked'
import type { Task } from '../../tasks/shared/types'
import { RECENT_DAYS } from './tasks'

/** What the Start picker lists for what is typed: the open tasks that match, and (once something is typed) a task to create. */
export interface PickerOptions {
  tasks: Task[]
  /** The title a "Create task" would use: the typed text, trimmed; null while nothing is typed. */
  create: string | null
}

/**
 * The open tasks whose title holds what is typed (those that start with it first, then the rest, each group in the
 * order given), at most `limit`; and always, once something is typed, the title to create. Nothing is listed before
 * anything is typed.
 */
export function pickerOptions(tasks: readonly Task[], typed: string, limit = 8): PickerOptions {
  const q = fold(typed.trim())
  if (!q) return { tasks: [], create: null }
  const hits = tasks.filter((t) => fold(t.title).includes(q))
  const starts = hits.filter((t) => fold(t.title).startsWith(q))
  return {
    tasks: [...starts, ...hits.filter((t) => !starts.includes(t))].slice(0, limit),
    create: typed.trim()
  }
}

/**
 * The open tasks the timer was on in the last week up to `today`, the most recently used first, each once, at most
 * `limit`: what the picker offers before anything is typed.
 */
export function recentTasks(
  year: TrackingYear,
  open: readonly Task[],
  today: string,
  limit = 5
): Task[] {
  const from = addDays(today, 1 - RECENT_DAYS)
  const used = [
    ...year.sessions.map((s) => ({ key: s.task, date: s.date, at: `${s.date} ${s.start}` })),
    ...year.adjusts.map((a) => ({ key: a.task, date: a.date, at: `${a.date} 99:99:99` }))
  ]
    .filter((e) => e.date >= from && e.date <= today)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  const found: Task[] = []
  for (const { key } of used) {
    const uid = taskUidOf(key)
    const task = uid ? open.find((t) => t.uid === uid) : undefined
    if (task && !found.includes(task)) found.push(task)
  }
  return found.slice(0, limit)
}

/** The client a task's list stands for: the list's name when it is one of the open contracts' clients (ignoring case). */
export function clientOfList(contracts: readonly OpenContract[], list: string): string | undefined {
  const wanted = list.trim().toLowerCase()
  return contracts.flatMap((c) => c.clients).find((c) => c.toLowerCase() === wanted)
}

/**
 * The client a task's time is for. Where there are no clients (Research) there is none. The task's list names it when it
 * can; with one client, that one; otherwise (several clients and a list that is none of them) it is `ask`, with the
 * choices, and the picker asks.
 */
export function clientForTask(
  contracts: readonly OpenContract[],
  list: string
): { client: string | undefined; ask: null } | { client?: undefined; ask: string[] } {
  const all = contracts.flatMap((c) => c.clients)
  if (all.length === 0) return { client: undefined, ask: null }
  const named = clientOfList(contracts, list)
  if (named) return { client: named, ask: null }
  if (all.length === 1) return { client: all[0], ask: null }
  return { ask: all }
}

/** A task's list: a subtask has none of its own and sits in its parent's. */
export function listOfTask(task: Task, all: readonly Task[]): string {
  if (task.list || !task.parentUid) return task.list
  return all.find((t) => t.uid === task.parentUid)?.list ?? ''
}

/**
 * The list a new task goes to. In Work (a client is known) it is the client's own list, empty or not: Work's lists are its
 * clients and nothing else. Elsewhere, where a task was last added, else the first list there is, else "Inbox" (a task needs
 * a list).
 */
export function listForNew(
  open: readonly Task[],
  client: string | undefined,
  last: string
): string {
  if (client) return client
  return listForNewTask(open, last) || 'Inbox'
}
