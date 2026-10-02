import { useRowNavigation } from '@renderer/components/useRowNavigation'
import { formatHours, formatSignedHours } from '@shared/tracking/format'
import type { Workspace } from '@shared/settings'
import type { Moment } from '@shared/tracking/types'
import { yearLabel } from '@shared/year'
import { yearRows } from '../shared/years'
import { useYearFiles } from './useYearFiles'
import styles from './YearsTable.module.css'

/** One row per year: its hours, plan so far, balance, average week and days off taken. A row shows that year in the charts above. */
export function YearsTable({
  workspace,
  years,
  selected,
  onSelect,
  now
}: {
  workspace: Workspace
  years: readonly string[]
  selected: string
  onSelect: (year: string) => void
  now: Moment
}): React.JSX.Element | null {
  const files = useYearFiles(workspace, years)
  const rows = files ? yearRows(files, now) : []
  const { tableProps, rowProps } = useRowNavigation(rows.length, (i) => onSelect(rows[i].start))
  if (!files) return null

  return (
    <section className={styles.card} aria-label="Years">
      <div className={styles.wrap}>
        <table className={styles.table} {...tableProps}>
          <thead>
            <tr>
              <th scope="col">Year</th>
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
                Average week
              </th>
              <th scope="col" className={styles.right}>
                Days off
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, index) => (
              <tr
                key={r.start}
                className={styles.row}
                data-selected={r.start === selected || undefined}
                aria-selected={r.start === selected}
                {...rowProps(index)}
                onClick={() => onSelect(r.start)}
              >
                <td>{yearLabel(r.start)}</td>
                <td className={styles.right}>{formatHours(r.minutes)}</td>
                <td className={styles.right}>{formatHours(r.plan)}</td>
                <td className={styles.right}>{formatSignedHours(Math.round(r.balance))}</td>
                <td className={styles.right}>
                  {r.averageWeek === null ? '–' : formatHours(r.averageWeek)}
                </td>
                <td className={styles.right}>{r.daysOff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
