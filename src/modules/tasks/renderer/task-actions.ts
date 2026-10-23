import { showToast } from '@renderer/components/toast-store'
import { pushUndo } from '@renderer/components/undo-store'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { openRoute } from '@renderer/shell/navigate-store'
import { formatDate } from '@shared/time'
import { formatDuration } from '@shared/time'
import { describeRecurrence } from '../shared/recurrence'
import { taskRoute } from './tasks-paths'
import type { Task, TaskChanges, TaskStatus } from '../shared/types'

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
        label: 'status change',
        undo: async () => {
          await window.api.tasks.setStatus(task.uid, before.status)
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
  await window.api.tasks.update(task.uid, changes)
  pushUndo({
    label,
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
