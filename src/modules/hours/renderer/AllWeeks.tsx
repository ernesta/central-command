import { useNavigate } from 'react-router'
import { useRowNavigation } from '@renderer/components/useRowNavigation'
import { formatHours, formatRange, formatSignedHours } from '@shared/tracking/format'
import { weekTotals } from '@shared/tracking/plan'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import { weekRoute } from './hours-paths'
import styles from './AllWeeks.module.css'

/** Every week of the year, newest first: hours, plan so far, balance and the running year balance. A row opens its week. */
export function AllWeeks({
  workspace,
  data,
  now
}: {
  workspace: string
  data: TrackingYear
  now: Moment
}): React.JSX.Element {
  const navigate = useNavigate()
  // Weeks that have not begun are left out, so the newest row is this week.
  const rows = weekTotals(data, now.date, now)
    .filter((w) => w.from <= now.date)
    .reverse()
  const open = (index: number): void =>
    void navigate(weekRoute(workspace, data.start, rows[index].from))
  const { tableProps, rowProps } = useRowNavigation(rows.length, open)

  return (
    <section className={styles.card} aria-label="All weeks">
      <div className={styles.wrap}>
        <table className={styles.table} {...tableProps}>
          <thead>
            <tr>
              <th scope="col">Week</th>
              <th scope="col">Dates</th>
              <th scope="col" className={styles.right}>
                Hours
              </th>
              <th scope="col" className={styles.right}>
                Plan
              </th>
              <th scope="col" className={styles.right}>
                Balance
              </th>
              <th scope="col" className={styles.right}>
                Year
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w, index) => {
              return (
                <tr
                  key={w.from}
                  className={styles.row}
                  {...rowProps(index)}
                  onClick={() => open(index)}
                >
                  <td>
                    {w.number}
                    {w.inProgress && <span className={styles.tag}>now</span>}
                  </td>
                  <td>{formatRange(w.from, w.to)}</td>
                  <td className={styles.right}>{formatHours(w.minutes)}</td>
                  <td className={styles.right}>{formatHours(w.plan)}</td>
                  <td className={styles.right}>{formatSignedHours(w.balance)}</td>
                  <td className={styles.right}>{formatSignedHours(w.yearBalance)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
