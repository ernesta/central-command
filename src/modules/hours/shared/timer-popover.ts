import { taskUidOf } from '../../tasks/shared/tracked'
import type { Task } from '../../tasks/shared/types'
import { listOfTask } from './start-picker'

/** The hint under a timer that cannot stop yet, and the tooltip of the greyed-out Stop. */
export const STOP_NEEDS_TASK = 'Pick a task to stop the timer.'

/** What the top block of the timer popover says and allows. */
export interface PopoverHead {
  title: string
  /** The line under the title: the task's list, a nudge, or the reason Stop is off. Null when the list is not known. */
  line: string | null
  /** The line is a nudge or a reason, not a list (drawn quiet and italic). */
  hint: boolean
  stopDisabled: boolean
  /** The picker is shown below the divider. */
  picker: boolean
}

/**
 * The five states of the popover, from the running timer's task and label and whether Stop was pressed with no task.
 * `tasks` are all tasks, done or trashed included, so a finished task still shows its list.
 * With a task: its title and list, Stop on. Without: "No task yet" and the picker; after Stop, "Which task was this?"
 * with Stop off until one is picked.
 */
export function popoverHead(
  session: { task?: string; label: string },
  tasks: readonly Task[],
  stopAfter: boolean
): PopoverHead {
  if (session.task) {
    const uid = taskUidOf(session.task)
    const task = uid ? tasks.find((t) => t.uid === uid) : undefined
    return {
      title: session.label || task?.title || 'No title',
      line: task ? listOfTask(task, tasks) || null : null,
      hint: false,
      stopDisabled: false,
      picker: false
    }
  }
  return stopAfter
    ? {
        title: 'Which task was this?',
        line: STOP_NEEDS_TASK,
        hint: true,
        stopDisabled: true,
        picker: true
      }
    : {
        title: session.label || 'No task yet',
        line: 'Pick one below',
        hint: true,
        stopDisabled: false,
        picker: true
      }
}
