import { Link } from 'react-router'
import { useNow } from '@renderer/state/use-now'
import { useRunningTimer } from '@renderer/state/use-running-timer'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { formatHours } from '@shared/tracking/format'
import { dailyAim } from '@shared/tracking/plan'
import { dayMinutes } from '@shared/tracking/totals'
import { inYear } from '@shared/year'
import { hoursBase, useHoursWorkspace } from './hours-paths'
import { useShownYear } from './useMeetingHours'
import styles from './HoursCard.module.css'

/** The Hours entry on a workspace's landing page: today's time against the aim. The title is a real link whose hit area covers the whole card. */
export function HoursCard(): React.JSX.Element {
  const workspace = useHoursWorkspace()
  const { data: stored } = useTrackingYear(workspace)
  const { running } = useRunningTimer()
  const now = useNow(running !== null)
  const data = useShownYear(workspace, stored, now.date)
  const today = data && inYear(now.date, data.start, data.weeks) ? data : null
  const aim = today ? dailyAim(today, now.date) : null

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>
        <Link className={styles.link} to={hoursBase(workspace)}>
          Hours
        </Link>
      </h2>
      {today && (
        <p className={styles.line}>
          Today {formatHours(dayMinutes(today, now.date, now))}
          {aim !== null && ` of ${formatHours(aim)}`}
        </p>
      )}
    </div>
  )
}
