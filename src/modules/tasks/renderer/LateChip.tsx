import { lateLabel } from '../shared/late'
import styles from './LateChip.module.css'

/** "3 days late": the one mark of an overdue task, the same in Home, Tasks, search and the task page. Nothing when not late. */
export function LateChip({ days }: { days: number }): React.JSX.Element | null {
  if (days <= 0) return null
  return <span className={styles.chip}>{lateLabel(days)}</span>
}
