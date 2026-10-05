import type { TaskPriority, TaskStatus } from '../shared/types'
import { PRIORITY_MARKS } from './task-labels'
import styles from './TaskIcons.module.css'

/**
 * Status as an icon: an empty circle (to do), a half-filled one (in progress), a filled one with a tick (done). Drawn here, not
 * with Lucide, because Lucide has no half-filled circle and the three have to read as one family.
 */
export function StatusIcon({
  status,
  size = 22
}: {
  status: TaskStatus
  size?: number
}): React.JSX.Element {
  return (
    <svg
      className={styles[`status_${status}`]}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {status === 'done' ? (
        <>
          <circle cx="12" cy="12" r="9.5" fill="currentColor" stroke="none" />
          <path d="m7.8 12.3 3 3 5.6-6" className={styles.tick} />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="8.5" />
          {status === 'doing' && <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />}
        </>
      )}
    </svg>
  )
}

/** P1, P2 or P3: solid accent, a tint of the same colour, a quiet grey. */
export function PriorityBadge({ priority }: { priority: TaskPriority }): React.JSX.Element {
  return (
    <span className={[styles.badge, styles[`priority_${priority}`]].join(' ')}>
      {PRIORITY_MARKS[priority]}
    </span>
  )
}
