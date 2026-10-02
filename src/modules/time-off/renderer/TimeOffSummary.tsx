import { timeOffCounts } from '@shared/tracking/timeoff'
import { TIME_OFF_TYPES, type TrackingYear } from '@shared/tracking/types'
import styles from './TimeOffSummary.module.css'

/** Days a year, taken, booked and left to book, as numbers and as one bar, with the count of each kind. */
export function TimeOffSummary({
  data,
  today
}: {
  data: TrackingYear
  today: string
}): React.JSX.Element {
  const c = timeOffCounts(data, today)
  // Booked past the allowance still draws to scale: the bar grows to the days used.
  const scale = Math.max(c.allowance, c.taken + c.booked, 1)
  const percent = (days: number): string => `${(days / scale) * 100}%`
  const kinds = TIME_OFF_TYPES.filter((t) => c.byType[t.id] > 0)
    .map((t) => `${t.label} ${c.byType[t.id]}`)
    .join(' · ')

  return (
    <section className={styles.card} aria-label="Summary">
      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt className={styles.label}>Days a year</dt>
          <dd className={styles.value}>{c.allowance}</dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.label}>Taken</dt>
          <dd className={styles.value}>{c.taken}</dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.label}>Booked</dt>
          <dd className={styles.value}>{c.booked}</dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.label}>Left to book</dt>
          <dd className={styles.value}>{c.left}</dd>
        </div>
      </dl>
      <div
        className={styles.bar}
        role="img"
        aria-label={`${c.taken} taken, ${c.booked} booked, ${c.left} left to book`}
      >
        <span className={styles.taken} style={{ width: percent(c.taken) }} />
        <span className={styles.booked} style={{ width: percent(c.booked) }} />
      </div>
      {kinds && <p className={styles.kinds}>{kinds}</p>}
    </section>
  )
}
