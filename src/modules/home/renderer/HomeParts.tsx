import { Link } from 'react-router'
import { StatusIcon } from '../../tasks/renderer/TaskIcons'
import {
  NEXT_STATUS,
  STATUS_LABELS,
  nextStatus,
  setTaskStatus
} from '../../tasks/renderer/task-actions'
import type { TaskStatus } from '../../tasks/shared/types'
import styles from './Home.module.css'

/** The task's status circle, as in Tasks: click moves it on (to do, in progress, done), Shift-click moves it back. */
export function StatusButton({
  uid,
  status
}: {
  uid: string
  status: TaskStatus
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={styles.status}
      title={`${STATUS_LABELS[status]} · click for ${STATUS_LABELS[NEXT_STATUS[status]]}`}
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
  )
}

/** A quiet text link in a card's heading row ("Hours", "See all"). */
export function StyledLink({
  to,
  children
}: {
  to: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Link className={styles.link} to={to}>
      {children}
    </Link>
  )
}

/** The message in a card that has nothing to list. */
export function None({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className={styles.none}>{children}</p>
}
