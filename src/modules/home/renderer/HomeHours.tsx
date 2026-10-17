import { Panel } from '@renderer/components/Panel'
import { useNow } from '@renderer/state/use-now'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { formatHours } from '@shared/tracking/format'
import { hasAim } from '@shared/tracking/plan'
import { inYear } from '@shared/year'
import { hoursBase } from '../../hours/renderer/hours-paths'
import { PeriodSummary } from '../../hours/renderer/PeriodSummary'
import { useShownYear } from '../../hours/renderer/useMeetingHours'
import { periodFigures } from '../../hours/shared/so-far'
import type { HomeWorkspace } from '../shared/types'
import { StyledLink } from './HomeParts'
import styles from './Home.module.css'

/**
 * Time so far against the aim: Research's week, or Work's invoice period (the month, or the week for a contract invoiced
 * by week) with the hours per client. Read from the same tracking files as the Hours page, meetings' derived hours
 * included, so the two always agree. The running timer is not repeated here: it is in the top bar.
 */
export function HomeHours({ workspace }: { workspace: HomeWorkspace }): React.JSX.Element | null {
  const { data: stored } = useTrackingYear(workspace)
  const now = useNow(false)
  const data = useShownYear(workspace, stored, now.date)
  if (!data || !inYear(now.date, data.start, data.weeks)) return null

  const { label, minutes, aim, today, clients } = periodFigures(data, now)

  return (
    <Panel label={label} actions={<StyledLink to={hoursBase(workspace)}>Hours</StyledLink>}>
      {hasAim(data) && aim > 0 ? (
        <div className={styles.hours}>
          <PeriodSummary minutes={minutes} aim={aim} />
        </div>
      ) : (
        <p className={styles.total}>{formatHours(minutes)}</p>
      )}
      <p className={styles.small}>Today {formatHours(today)}</p>
      {clients.length > 0 && (
        <ul className={styles.list}>
          {clients.map((c) => (
            <li key={c.client ?? ''} className={styles.plain}>
              <span className={styles.grow}>{c.client ?? 'No client'}</span>
              <span className={styles.num}>{formatHours(c.minutes)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
