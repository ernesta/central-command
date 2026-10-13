import { formatHours, formatSignedHours } from '@shared/tracking/format'
import styles from './PeriodSummary.module.css'

interface PeriodSummaryProps {
  /** Hours worked in the period, in minutes. */
  minutes: number
  /** The period's whole aim, in minutes: the balance and the bar are against this, not against what is expected so far. */
  aim: number
}

/** The summary row of the Week and invoice cards: hours worked of the aim, the signed balance, and one bar. */
export function PeriodSummary({ minutes, aim }: PeriodSummaryProps): React.JSX.Element {
  const balance = minutes - aim
  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <span className={styles.worked}>
          {formatHours(minutes)}
          <small className={styles.of}>of {formatHours(aim)}</small>
        </span>
        <span className={styles.balance} data-behind={balance < 0 || undefined}>
          {formatSignedHours(balance)}
        </span>
      </div>
      <div className={styles.track} aria-hidden>
        <i
          className={styles.fill}
          style={{ width: `${aim > 0 ? Math.min(minutes / aim, 1) * 100 : 0}%` }}
        />
      </div>
    </div>
  )
}
