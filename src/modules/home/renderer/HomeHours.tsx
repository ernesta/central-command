import { Panel } from '@renderer/components/Panel'
import { useNow } from '@renderer/state/use-now'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { formatHours } from '@shared/tracking/format'
import { hasAim } from '@shared/tracking/plan'
import { isAllContracts } from '@shared/tracking/scope'
import { hasContracts, inContract } from '@shared/tracking/workspace-weeks'
import type { Moment } from '@shared/tracking/types'
import { useYearFiles } from '@renderer/state/use-year-files'
import { hoursBase } from '../../hours/renderer/hours-paths'
import { PeriodSummary } from '../../hours/renderer/PeriodSummary'
import { useShownYear, useShownYears } from '../../hours/renderer/useMeetingHours'
import { allFigures } from '../../hours/shared/all-figures'
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
  const { data: stored, scope, years, loaded } = useTrackingYear(workspace)
  const now = useNow(false)
  const data = useShownYear(workspace, stored, now.date)
  const actions = <StyledLink to={hoursBase(workspace)}>Hours</StyledLink>
  // Work under All contracts: today, this week and this month, each summed over every contract.
  if (hasContracts(workspace) && isAllContracts(scope))
    return <HomeAllHours starts={years} now={now} actions={actions} />
  if (!data || !inContract(now.date, data)) {
    return hasContracts(workspace) && loaded && years.length > 0 ? (
      <Panel label="Hours" actions={actions}>
        <p className={styles.small}>Outside this contract today.</p>
      </Panel>
    ) : null
  }

  const { label, minutes, aim, today, clients } = periodFigures(data, now, workspace)

  return (
    <Panel label={label} actions={actions}>
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

/**
 * Work's hours under All contracts: today, this week (Monday to Sunday) and this month (the calendar month), each one total over
 * every contract, with no split by contract or client. No aim: it means nothing across contracts.
 */
function HomeAllHours({
  starts,
  now,
  actions
}: {
  starts: readonly string[]
  now: Moment
  actions: React.ReactNode
}): React.JSX.Element | null {
  const files = useYearFiles('work', starts)
  const years = useShownYears('work', files, now.date)
  if (!years || starts.length === 0) return null
  const figures = allFigures(years, now)
  const rows = [
    ['Today', figures.today],
    ['This week', figures.week.minutes],
    ['This month', figures.month]
  ] as const

  return (
    <Panel label="All contracts" actions={actions}>
      <ul className={styles.list}>
        {rows.map(([label, minutes]) => (
          <li key={label} className={styles.plain}>
            <span className={styles.grow}>{label}</span>
            <span className={styles.num}>{formatHours(minutes)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
