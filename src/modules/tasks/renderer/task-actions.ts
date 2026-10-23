import { showToast } from '@renderer/components/toast-store'
import { pushUndo } from '@renderer/components/undo-store'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { openRoute } from '@renderer/shell/navigate-store'
import { formatDate } from '@shared/time'
import { formatDuration } from '@shared/time'
import { describeRecurrence } from '../shared/recurrence'
import { PRIORITY_MARKS } from './task-labels'
import { taskRoute } from './tasks-paths'
import type { Task, TaskChanges, TaskStatus } from '../shared/types'

/** A task's title for a toast: the first 40 characters, or Untitled. */
export function shortTitle(title: string | undefined): string {
  const t = (title ?? '').trim() || 'Untitled'
  return t.length > 40 ? `${t.slice(0, 39)}…` : t
}

const FIELD_NAMES: Partial<Record<keyof TaskChanges, string>> = {
  due: 'due date change',
  list: 'list change',
  sublist: 'list change',
  priority: 'priority change',
  recurrence: 'repeat change',
  title: 'title change',
  tags: 'tag change',
  parentUid: 'move',
  description: 'notes change'
}

/** What a change to a task is called, from the fields it touches ("due date change"); a mixed one is just a "change". */
function changeName(changes: TaskChanges): string {
  const names = new Set(
    (Object.keys(changes) as (keyof TaskChanges)[]).map((k) => FIELD_NAMES[k] ?? 'change')
  )
  return names.size === 1 ? [...names][0] : 'change'
}

/** Cmd-Z's toast for a task field put back: "Changed due date of “X” back to Oct 30, 2026." (an empty value reads "no date", "no list", …). */
export function changedBackMessage(
  title: string | undefined,
  what: string,
  value: string | null | undefined,
  empty: string
): string {
  return `Changed ${what} of “${shortTitle(title)}” back to ${value ? value : empty}.`
}

/** The sentence for putting `before` back, when the change touched one thing; otherwise a general one. */
function undoMessage(task: Task, changes: TaskChanges, before: TaskChanges): string {
  const keys = Object.keys(changes) as (keyof TaskChanges)[]
  const only = (...ks: (keyof TaskChanges)[]): boolean => keys.every((k) => ks.includes(k))
  const b = before as Partial<Task>
  if (only('due'))
    return changedBackMessage(task.title, 'due date', b.due ? formatDate(b.due) : null, 'no date')
  if (only('list', 'sublist'))
    return changedBackMessage(
      task.title,
      'list',
      [b.list, b.sublist].filter(Boolean).join(' / '),
      'no list'
    )
  if (only('priority'))
    return changedBackMessage(task.title, 'priority', b.priority && PRIORITY_MARKS[b.priority], '')
  if (only('title')) return changedBackMessage(task.title, 'title', b.title, 'no title')
  if (only('tags')) return changedBackMessage(task.title, 'tags', b.tags?.join(', '), 'no tags')
  if (only('recurrence'))
    return changedBackMessage(
      task.title,
      'repeat',
      b.recurrence ? describeRecurrence(b.recurrence).toLowerCase() : null,
      'no repeat'
    )
  if (only('description')) return `Changed the notes of “${shortTitle(task.title)}” back.`
  return `Changed “${shortTitle(task.title)}” back.`
}

/** The toast after a delete; the time that left Hours with the task is said, since Undo brings it back. */
export function deletedMessage(title: string, minutes: number): string {
  return `Deleted “${title || 'Untitled'}”${minutes > 0 ? ` and ${formatDuration(minutes)} of time` : ''}.`
}

/** To do, in progress, done, and round again. */
export const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'doing',
  doing: 'done',
  done: 'todo'
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  doing: 'In progress',
  done: 'Done'
}

export const PREVIOUS_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'done',
  doing: 'todo',
  done: 'doing'
}

/** Where a click on the status icon goes: round the circle; with Shift, round it the other way. */
export function nextStatus(status: TaskStatus, shift: boolean): TaskStatus {
  return shift ? PREVIOUS_STATUS[status] : NEXT_STATUS[status]
}

/**
 * Change a task's status. Finishing a recurring task starts the next one in the main process; this says so, since the finished
 * one leaves the list. Failures show the same way.
 */
export async function setTaskStatus(
  task: Pick<Task, 'uid'> & { recurrence?: Task['recurrence'] },
  status: TaskStatus
): Promise<void> {
  try {
    const before = await window.api.tasks.get(task.uid)
    const { next } = await window.api.tasks.setStatus(task.uid, status)
    if (before && before.status !== status) {
      pushUndo({
        label: `status change of “${shortTitle(before.title)}” from ${STATUS_LABELS[before.status]} to ${STATUS_LABELS[status]}`,
        message: changedBackMessage(before.title, 'status', STATUS_LABELS[before.status], ''),
        open: () => openRoute(taskRoute(before.workspace, before.uid)),
        undo: async () => {
          await window.api.tasks.setStatus(task.uid, before.status)
          // Finishing a task with no date gave it today; taking the finish back takes that with it.
          if (!before.due && before.status !== 'done')
            await window.api.tasks.update(task.uid, { due: null })
          // Finishing a recurring task started the next one; taking the finish back takes that with it.
          if (next) await window.api.tasks.delete(next.uid)
        }
      })
    }
    if (next?.due) {
      showToast(
        `Done. The next one is due ${formatDate(next.due)}${task.recurrence ? ` (${describeRecurrence(task.recurrence).toLowerCase()})` : ''}.`,
        { label: 'Open', run: () => openRoute(taskRoute(next.workspace, next.uid)) }
      )
    }
  } catch (error) {
    showToast(`Couldn’t change the status: ${ipcErrorMessage(error)}`)
  }
}

/** What a change overwrites, so that putting it back is one update. A move under a parent (or out of one) also brings the list back. */
function previousValues(task: Task, changes: TaskChanges): TaskChanges {
  const keys = new Set(Object.keys(changes) as (keyof TaskChanges)[])
  if (keys.has('parentUid')) {
    keys.add('list')
    keys.add('sublist')
  }
  const before: Record<string, unknown> = {}
  for (const key of keys) before[key] = task[key]
  return before as TaskChanges
}

/** Change a task and remember how to put it back (Cmd-Z). Errors are thrown for the caller to show. */
export async function updateTaskUndoable(
  task: Task,
  changes: TaskChanges,
  label: string
): Promise<void> {
  const before = previousValues(task, changes)
  const named = label === 'task change' ? changeName(changes) : label
  await window.api.tasks.update(task.uid, changes)
  pushUndo({
    label: `${named} on “${shortTitle(task.title)}”`,
    message: undoMessage(task, changes, before),
    open: () => openRoute(taskRoute(task.workspace, task.uid)),
    undo: async () => {
      await window.api.tasks.update(task.uid, before)
    }
  })
}

/** The minutes of saved time that deleting these tasks would take out of Hours (each counted once, with its subtasks). */
export async function timeOnTasks(uids: readonly (string | null | undefined)[]): Promise<number> {
  const unique = [...new Set(uids.filter((u): u is string => !!u && u !== 'auto'))]
  const each = await Promise.all(unique.map((u) => window.api.tasks.timeOn(u)))
  return each.reduce((sum, m) => sum + m, 0)
}
