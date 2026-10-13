import { AllLink } from '@renderer/components/Landing'
import { formatHours, formatSignedHours } from '@shared/tracking/format'
import { hasAim, yearTotals } from '@shared/tracking/plan'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import type { HoursWorkspace } from '../shared/workspaces'
import { yearRoute } from './hours-paths'
import styles from './BalanceCard.module.css'

/**
 * The whole contract (Work) or year (Research) as one quiet line under the cards: the hours of the whole plan, the balance
 * against the plan up to today, the average week, and the link to the charts. With no aim: the hours and the average week.
 */
export function BalanceCard({
  workspace,
  data,
  now
}: {
  workspace: HoursWorkspace
  data: TrackingYear
  now: Moment
}): React.JSX.Element {
  const totals = yearTotals(data, now.date, now)
  const balance = Math.round(totals.balance)
  const aim = hasAim(data)
  const average = totals.averageWeek === null ? '–' : formatHours(totals.averageWeek)

  return (
    <footer className={styles.line} aria-label="Balance">
      <span>
        Whole {workspace === 'work' ? 'contract' : 'year'}: <b>{formatHours(totals.minutes)}</b>
        {aim && (
          <>
            {' '}
            of <b>{formatHours(totals.wholePlan)}</b> · balance <b>{formatSignedHours(balance)}</b>
          </>
        )}{' '}
        · average week <b>{average}</b>
      </span>
      <AllLink to={yearRoute(workspace, data.start)}>Charts and weeks</AllLink>
    </footer>
  )
}
