import { formatHours, formatSignedHours } from '@shared/tracking/format'
import { yearTotals } from '@shared/tracking/plan'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import styles from './BalanceCard.module.css'

/** The year so far: the balance against the plan up to today, the average week, the hours and the whole year's plan. */
export function BalanceCard({ data, now }: { data: TrackingYear; now: Moment }): React.JSX.Element {
  const totals = yearTotals(data, now.date, now)
  const perDay =
    data.plan.workDays.length > 0 ? data.plan.hoursPerWeek / data.plan.workDays.length : 0
  const days = perDay > 0 ? Math.round(totals.wholePlan / perDay) : 0
  const balance = Math.round(totals.balance)

  return (
    <section className={styles.card} aria-label="Balance">
      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt className={styles.label}>Balance</dt>
          <dd className={styles.value}>
            {formatSignedHours(balance)}
            <small> {balance > 0 ? 'ahead' : balance < 0 ? 'behind' : 'on plan'}</small>
          </dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.label}>Average week</dt>
          <dd className={styles.value}>
            {totals.averageWeek === null ? '–' : formatHours(totals.averageWeek)}
          </dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.label}>Hours so far</dt>
          <dd className={styles.value}>{formatHours(totals.minutes)}</dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.label}>Planned, {days} days</dt>
          <dd className={styles.value}>{formatHours(totals.wholePlan)}</dd>
        </div>
      </dl>
    </section>
  )
}
