import { Link } from 'react-router'
import { yearLabel } from '@shared/year'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { hoursBase, useHoursWorkspace } from './hours-paths'
import styles from './HoursCard.module.css'

/** The Hours entry on a workspace's landing page. The title is a real link whose hit area covers the whole card. */
export function HoursCard(): React.JSX.Element {
  const workspace = useHoursWorkspace()
  const { year } = useTrackingYear(workspace)

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>
        <Link className={styles.link} to={hoursBase(workspace)}>
          Hours
        </Link>
      </h2>
      <p className={styles.line}>{yearLabel(year)}</p>
    </div>
  )
}
