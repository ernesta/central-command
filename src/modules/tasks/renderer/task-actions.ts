import { formatDate } from '@shared/time'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { describeRecurrence } from '../shared/recurrence'
import type { Task, TaskStatus } from '../shared/types'
import { showTaskToast } from './task-toast'

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

/** Where a click on the status icon goes: round the circle; with Shift, straight to done (or back to to do). */
export function nextStatus(status: TaskStatus, shift: boolean): TaskStatus {
  if (shift) return status === 'done' ? 'todo' : 'done'
  return NEXT_STATUS[status]
}

/**
 * Change a task's status. Finishing a recurring task starts the next one in the main process; this says so, since the finished
 * one leaves the list. Failures show the same way.
 */
export async function setTaskStatus(task: Task, status: TaskStatus): Promise<void> {
  try {
    const { next } = await window.api.tasks.setStatus(task.uid, status)
    if (next?.due) {
      showTaskToast(
        `Done. The next one is due ${formatDate(next.due)}${task.recurrence ? ` (${describeRecurrence(task.recurrence).toLowerCase()})` : ''}.`
      )
    }
  } catch (error) {
    showTaskToast(`Couldn’t change the status: ${ipcErrorMessage(error)}`)
  }
}
