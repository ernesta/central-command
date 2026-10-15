import { useMemo } from 'react'
import { Panel } from '@renderer/components/Panel'
import { useNow } from '@renderer/state/use-now'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { formatHours } from '@shared/tracking/format'
import { hasAim, weekTotals } from '@shared/tracking/plan'
import { dayMinutes, weekMinutes } from '@shared/tracking/totals'
import { invoiceOf } from '@shared/tracking/types'
import { addDays, inYear, weekStartOf } from '@shared/year'
import { hoursBase } from '../../hours/renderer/hours-paths'
import { PeriodSummary } from '../../hours/renderer/PeriodSummary'
import { useShownYear } from '../../hours/renderer/useMeetingHours'
import { periodOfWeek, periodsOf } from '../../hours/shared/periods'
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
  const week = weekStartOf(now.date)
  const periods = useMemo(
    () => (data && workspace === 'work' ? periodsOf(data, now) : []),
    [data, workspace, now]
  )
  if (!data || !inYear(now.date, data.start, data.weeks)) return null

  const period = workspace === 'work' ? periodOfWeek(periods, week) : null
  const byMonth = invoiceOf(data) === 'month'
  const label = workspace === 'work' && byMonth ? 'This month' : 'This week'
  const minutes = period ? period.minutes : weekMinutes(data, week, now)
  const aim = period
    ? period.plan
    : (weekTotals(data, addDays(week, 6), now).find((w) => w.from === week)?.plan ?? 0)

  return (
    <Panel label={label} actions={<StyledLink to={hoursBase(workspace)}>Hours</StyledLink>}>
      {hasAim(data) ? (
        <div className={styles.hours}>
          <PeriodSummary minutes={minutes} aim={aim} />
        </div>
      ) : (
        <p className={styles.total}>{formatHours(minutes)}</p>
      )}
      <p className={styles.small}>Today {formatHours(dayMinutes(data, now.date, now))}</p>
      {period && period.clients.length > 0 && (
        <ul className={styles.list}>
          {period.clients.map((c) => (
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
