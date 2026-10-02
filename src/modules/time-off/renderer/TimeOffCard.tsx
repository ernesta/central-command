import { Link } from 'react-router'
import { useNow } from '@renderer/state/use-now'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { formatDay } from '@shared/tracking/format'
import { nextDayOff, timeOffCounts } from '@shared/tracking/timeoff'
import { inYear } from '@shared/year'
import { useHoursWorkspace } from '../../hours/renderer/hours-paths'
import { timeOffBase } from './time-off-paths'
import styles from './TimeOffCard.module.css'

/** The Time off entry on a workspace's landing page: days left to book, and what is taken and booked. */
export function TimeOffCard(): React.JSX.Element {
  const workspace = useHoursWorkspace()
  const { data } = useTrackingYear(workspace)
  const now = useNow(false)
  const current = data && inYear(now.date, data.start) ? data : null
  const counts = current ? timeOffCounts(current, now.date) : null
  const next = current ? nextDayOff(current, now.date) : null

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>
        <Link className={styles.link} to={timeOffBase(workspace)}>
          Time off
        </Link>
      </h2>
      {counts && (
        <>
          <p className={styles.line}>
            {counts.left} left to book of {counts.allowance} days
          </p>
          <p className={styles.line}>
            {counts.taken} taken · {counts.booked} booked{next && ` · next ${formatDay(next)}`}
          </p>
        </>
      )}
    </div>
  )
}
