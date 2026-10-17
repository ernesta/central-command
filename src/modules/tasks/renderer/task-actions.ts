import { showToast } from '@renderer/components/toast-store'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { formatDate } from '@shared/time'
import { describeRecurrence } from '../shared/recurrence'
import type { Task, TaskStatus } from '../shared/types'

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
    const { next } = await window.api.tasks.setStatus(task.uid, status)
    if (next?.due) {
      showToast(
        `Done. The next one is due ${formatDate(next.due)}${task.recurrence ? ` (${describeRecurrence(task.recurrence).toLowerCase()})` : ''}.`
      )
    }
  } catch (error) {
    showToast(`Couldn’t change the status: ${ipcErrorMessage(error)}`)
  }
}
