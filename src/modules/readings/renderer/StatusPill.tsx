import type { ReadingStatus } from '../shared/types'
import styles from './StatusPill.module.css'

export function StatusPill({ status }: { status: ReadingStatus }): React.JSX.Element {
  if (status === 'read') return <span className={`${styles.pill} ${styles.read}`}>Read</span>
  if (status === 'to_read')
    return <span className={`${styles.pill} ${styles.toRead}`}>To Read</span>
  return (
    <span className={`${styles.pill} ${styles.unset}`} aria-label="No status">
      —
    </span>
  )
}
