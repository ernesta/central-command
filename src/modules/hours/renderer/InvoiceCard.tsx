import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatHours, formatRange, formatSignedHours } from '@shared/tracking/format'
import { hasAim } from '@shared/tracking/plan'
import { invoiceOf, type Moment, type TrackingYear } from '@shared/tracking/types'
import { periodOfWeek, periodPlanSoFar, periodsOf } from '../shared/periods'
import styles from './InvoiceCard.module.css'

interface InvoiceCardProps {
  data: TrackingYear
  /** The first day of the week the page shows; its month is the one shown. */
  week: string
  onWeekChange: (week: string) => void
  now: Moment
}

/**
 * One invoice period at a time, with arrows between them. A contract invoiced by month shows the month: its weeks (whole
 * weeks) with their hours, the month against its plan, and the balance against what the weeks begun so far expect. One
 * invoiced by week shows the week: its hours per client. Where there is no aim there is no plan, balance or "to go".
 */
export function InvoiceCard({
  data,
  week,
  onWeekChange,
  now
}: InvoiceCardProps): React.JSX.Element | null {
  const periods = useMemo(() => periodsOf(data, now), [data, now])
  const month = periodOfWeek(periods, week)
  if (!month) return null
  const byWeek = invoiceOf(data) === 'week'
  const aimed = hasAim(data)
  const unit = byWeek ? 'week' : 'month'
  const index = periods.indexOf(month)
  const left = month.plan - month.minutes
  const begun = month.from <= now.date
  const balance = month.minutes - periodPlanSoFar(month, now.date)

  return (
    <section className={styles.card} aria-label="Invoice">
      <header className={styles.head}>
        <div className={styles.nav}>
          <button
            type="button"
            className={styles.arrow}
            aria-label={`Previous ${unit}`}
            disabled={index === 0}
            onClick={() => onWeekChange(periods[index - 1].weeks[0].from)}
          >
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
          </button>
          <span className={styles.label}>
            {month.name} · {formatRange(month.from, month.to)}
          </span>
          <button
            type="button"
            className={styles.arrow}
            aria-label={`Next ${unit}`}
            disabled={index === periods.length - 1}
            onClick={() => onWeekChange(periods[index + 1].weeks[0].from)}
          >
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        {begun && (
          <span className={styles.summary}>
            {aimed
              ? `${formatHours(month.minutes)} of ${formatHours(month.plan)} · ${
                  left > 0 ? `${formatHours(left)} to go` : `${formatHours(-left)} over`
                }`
              : formatHours(month.minutes)}
          </span>
        )}
      </header>
      {begun && aimed && !byWeek && (
        <p className={styles.note}>
          Balance {formatSignedHours(balance)} against{' '}
          {formatHours(periodPlanSoFar(month, now.date))} expected so far
        </p>
      )}
      <table className={styles.table}>
        {!byWeek && (
          <>
            <thead>
              <tr>
                <th scope="col">Week</th>
                <th scope="col" className={styles.right}>
                  Hours
                </th>
                {aimed && (
                  <th scope="col" className={styles.right}>
                    Plan
                  </th>
                )}
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
                    {aimed && <td className={styles.right}>{formatHours(w.plan)}</td>}
                  </tr>
                )
              })}
            </tbody>
          </>
        )}
        <tfoot>
          {begun &&
            month.clients.map((c) => (
              <tr key={c.client ?? ''} className={styles.clientRow}>
                <th scope="row">{c.client ?? 'No client'} – Total</th>
                <td className={styles.right}>{formatHours(c.minutes)}</td>
                {aimed && <td />}
              </tr>
            ))}
          <tr>
            <th scope="row">{month.name} – Total</th>
            <td className={styles.right}>{begun ? formatHours(month.minutes) : '—'}</td>
            {aimed && <td className={styles.right}>{formatHours(month.plan)}</td>}
          </tr>
        </tfoot>
      </table>
    </section>
  )
}
