import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatHours, formatRange, formatSignedHours } from '@shared/tracking/format'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import { monthOfWeek, monthPlanSoFar, monthsOf } from '../shared/months'
import styles from './MonthCard.module.css'

interface MonthCardProps {
  data: TrackingYear
  /** The first day of the week the page shows; its month is the one shown. */
  week: string
  onWeekChange: (week: string) => void
  now: Moment
}

/**
 * One invoice month at a time: its weeks (whole weeks) with their hours, the month against its plan, and the balance against what
 * the weeks begun so far expect.
 */
export function MonthCard({
  data,
  week,
  onWeekChange,
  now
}: MonthCardProps): React.JSX.Element | null {
  const months = useMemo(() => monthsOf(data, now), [data, now])
  const month = monthOfWeek(months, week)
  if (!month) return null
  const index = months.indexOf(month)
  const left = month.plan - month.minutes
  const begun = month.from <= now.date
  const balance = month.minutes - monthPlanSoFar(month, now.date)

  return (
    <section className={styles.card} aria-label="Month">
      <header className={styles.head}>
        <div className={styles.nav}>
          <button
            type="button"
            className={styles.arrow}
            aria-label="Previous month"
            disabled={index === 0}
            onClick={() => onWeekChange(months[index - 1].weeks[0].from)}
          >
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
          </button>
          <span className={styles.label}>
            {month.name} · {formatRange(month.from, month.to)}
          </span>
          <button
            type="button"
            className={styles.arrow}
            aria-label="Next month"
            disabled={index === months.length - 1}
            onClick={() => onWeekChange(months[index + 1].weeks[0].from)}
          >
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        {begun && (
          <span className={styles.summary}>
            {formatHours(month.minutes)} of {formatHours(month.plan)} ·{' '}
            {left > 0 ? `${formatHours(left)} to go` : `${formatHours(-left)} over`}
          </span>
        )}
      </header>
      {begun && (
        <p className={styles.note}>
          Balance {formatSignedHours(balance)} against{' '}
          {formatHours(monthPlanSoFar(month, now.date))} expected so far
        </p>
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col" className={styles.right}>
              Hours
            </th>
            <th scope="col" className={styles.right}>
              Plan
            </th>
          </tr>
        </thead>
        <tbody>
          {month.weeks.map((w) => {
            const shown = w.from === week
            return (
              <tr key={w.from} className={styles.row} data-current={shown}>
                <td>
                  <button
                    type="button"
                    className={styles.weekButton}
                    aria-current={shown || undefined}
                    onClick={() => onWeekChange(w.from)}
                  >
                    Week {w.number} · {formatRange(w.from, w.to)}
                  </button>
                </td>
                <td className={styles.right}>
                  {w.from <= now.date ? (
                    formatHours(w.minutes)
                  ) : (
                    <span className={styles.muted}>—</span>
                  )}
                </td>
                <td className={styles.right}>{formatHours(w.plan)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          {begun &&
            month.clients.map((c) => (
              <tr key={c.client ?? ''} className={styles.clientRow}>
                <th scope="row">{c.client ?? 'No client'} – Total</th>
                <td className={styles.right}>{formatHours(c.minutes)}</td>
                <td />
              </tr>
            ))}
          <tr>
            <th scope="row">{month.name} – Total</th>
            <td className={styles.right}>{begun ? formatHours(month.minutes) : '—'}</td>
            <td className={styles.right}>{formatHours(month.plan)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  )
}
