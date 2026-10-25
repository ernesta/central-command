import { Tooltip } from '@renderer/components/Tooltip'
import { StatusIcon } from './TaskIcons'
import { NEXT_STATUS, STATUS_LABELS, nextStatus, setTaskStatus } from './task-actions'
import type { TaskStatus } from '../shared/types'
import styles from './StatusButton.module.css'

/** The task's status circle, as in Tasks: click moves it on (to do, in progress, done), Shift-click moves it back. */
export function StatusButton({
  uid,
  status,
  locked = false
}: {
  uid: string
  status: TaskStatus
  /** A session task: its note and the clock set its status, so the circle only shows it. */
  locked?: boolean
}): React.JSX.Element {
  return (
    <Tooltip
      text={
        locked
          ? `${STATUS_LABELS[status]} · set by its meeting or training`
          : `${STATUS_LABELS[status]} · click for ${STATUS_LABELS[NEXT_STATUS[status]]}`
      }
    >
      <button
        type="button"
        className={[styles.status, locked && styles.locked].filter(Boolean).join(' ')}
        disabled={locked}
        aria-label={`Status: ${STATUS_LABELS[status]}`}
        onClick={(event) => {
          // The row is a link to the task; the circle only changes the status.
          event.preventDefault()
          event.stopPropagation()
          void setTaskStatus({ uid }, nextStatus(status, event.shiftKey))
        }}
      >
        <StatusIcon status={status} size={20} />
      </button>
    </Tooltip>
  )
}
