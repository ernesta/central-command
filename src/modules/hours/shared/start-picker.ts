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
 * What the picker offers before anything is typed, at most `limit`, each task once: the open tasks already worked on
 * `today` first (the latest first); then the others due `today`; then the ones the timer was on in the last week, those in progress before the rest, and within each the ones used on
 * the most days first (daily work such as admin rises), then the most recently used.
 */
export function suggestedTasks(
  year: TrackingYear,
  open: readonly Task[],
  today: string,
  limit = 6
): Task[] {
  const from = addDays(today, 1 - RECENT_DAYS)
  const used = [
    ...year.sessions.map((s) => ({ key: s.task, date: s.date, at: `${s.date} ${s.start}` })),
    ...year.adjusts.map((a) => ({ key: a.task, date: a.date, at: `${a.date} 99:99:99` }))
  ]
    .filter((e) => e.date >= from && e.date <= today)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  const recent: { task: Task; days: Set<string> }[] = []
  for (const { key, date } of used) {
    const uid = taskUidOf(key)
    const task = uid ? open.find((t) => t.uid === uid) : undefined
    if (!task) continue
    const entry = recent.find((r) => r.task === task)
    if (entry) entry.days.add(date)
    else recent.push({ task, days: new Set([date]) })
  }
  const rank = (r: { task: Task; days: Set<string> }): number => (r.task.status === 'doing' ? 1 : 0)
  // Array.sort is stable: equal ranks keep the most recently used first.
  const ordered = [...recent]
    .sort((a, b) => rank(b) - rank(a) || b.days.size - a.days.size)
    .map((r) => r.task)
  const worked = recent.filter((r) => r.days.has(today)).map((r) => r.task)
  const due = open.filter((t) => t.due === today)
  return [...new Set([...worked, ...due, ...ordered])].slice(0, limit)
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

/** What the picker shows beside a task: its list (a subtask shows its parent's). */
export function detailOfTask(task: Task, all: readonly Task[]): string {
  return listOfTask(task, all)
}

/**
 * The list the Create row offers, shown and changeable before anything is made. In Work (clients known) it is a client's own
 * list: the one the time is for (`hint`), else the one a task was last added to, else the first. Elsewhere, where a task was
 * last added, else the first list there is, else "Inbox" (a task needs a list).
 */
export function listForNew(
  open: readonly Task[],
  clients: readonly string[],
  last: string,
  hint?: string
): string {
  if (clients.length > 0) {
    const same = (a: string, b: string | undefined): boolean =>
      b !== undefined && a.trim().toLowerCase() === b.trim().toLowerCase()
    return clients.find((c) => same(c, hint)) ?? clients.find((c) => same(c, last)) ?? clients[0]
  }
  return listForNewTask(open, last) || 'Inbox'
}
