import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatHours, formatRange } from '@shared/tracking/format'
import { hasAim } from '@shared/tracking/plan'
import { inContract } from '@shared/tracking/workspace-weeks'
import { invoiceOf, type Moment, type TrackingYear } from '@shared/tracking/types'
import { periodOfWeek, periodsOf } from '../shared/periods'
import { defaultWeek } from '../shared/week'
import { BackToToday } from './BackToToday'
import { PeriodSummary } from './PeriodSummary'
import styles from './InvoiceCard.module.css'

interface InvoiceCardProps {
  data: TrackingYear
  /** The first day of the week the page shows; its month is the one shown. */
  week: string
  onWeekChange: (week: string) => void
  now: Moment
}

/**
 * One invoice period at a time, with arrows between them. The summary (hours of the period's whole aim, the balance against it
 * and one bar) is the Week card's. A contract invoiced by month lists its weeks (whole weeks) with their hours and a bar, the
 * current one bold with the accent stripe; one invoiced by week lists its hours per client. Where there is no aim there is
 * only the hours.
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
  const current = inContract(now.date, data)
    ? periodOfWeek(periods, defaultWeek(data.start, now.date, data.weeks, data.end))
    : undefined
  const begun = month.from <= now.date

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
        {current && current !== month && (
          <BackToToday
            label={`This ${unit}`}
            onClick={() => onWeekChange(defaultWeek(data.start, now.date, data.weeks, data.end))}
          />
        )}
      </header>
      {begun &&
        (aimed ? (
          <PeriodSummary minutes={month.minutes} aim={month.plan} />
        ) : (
          <p className={styles.total}>{formatHours(month.minutes)}</p>
        ))}
      <table className={styles.table}>
        {!byWeek && (
          <>
            <thead>
              <tr>
                <th scope="col">Week</th>
                <th scope="col" className={styles.right}>
                  Hours
                </th>
                {aimed && <th scope="col" />}
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
                    {aimed && (
                      <td>
                        {w.from <= now.date && (
                          <div className={styles.track} aria-hidden>
                            <i
                              className={styles.fill}
                              style={{
                                width: `${w.plan > 0 ? Math.min(w.minutes / w.plan, 1) * 100 : 0}%`
                              }}
                            />
                          </div>
                        )}
                      </td>
                    )}
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
                {aimed && !byWeek && <td />}
              </tr>
            ))}
        </tfoot>
      </table>
    </section>
  )
}
