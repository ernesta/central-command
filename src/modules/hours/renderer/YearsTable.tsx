import { useRowNavigation } from '@renderer/components/useRowNavigation'
import { formatHours, formatSignedHours } from '@shared/tracking/format'
import type { Workspace } from '@shared/settings'
import type { Moment } from '@shared/tracking/types'
import { contractLabel, hasContracts } from '@shared/tracking/workspace-weeks'
import { yearLabel } from '@shared/year'
import { yearRows } from '../shared/years'
import { useYearFiles } from '@renderer/state/use-year-files'
import type { HoursWorkspace } from '../shared/workspaces'
import { useShownYears } from './useMeetingHours'
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
  const files = useShownYears(workspace as HoursWorkspace, useYearFiles(workspace, years), now.date)
  const rows = files ? yearRows(files, now) : []
  const { tableProps, rowProps } = useRowNavigation(rows.length, (i) => onSelect(rows[i].start))
  if (!files) return null
  const contracts = hasContracts(workspace)

  return (
    <section className={styles.card} aria-label="Years">
      <div className={styles.wrap}>
        <table className={styles.table} {...tableProps}>
          <thead>
            <tr>
              <th scope="col">{contracts ? 'Contract' : 'Year'}</th>
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
              {!contracts && (
                <th scope="col" className={styles.right}>
                  Days off
                </th>
              )}
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
                <td>{contracts ? contractLabel(r.start, r.weeks, r.name) : yearLabel(r.start)}</td>
                <td className={styles.right}>{formatHours(r.minutes)}</td>
                <td className={styles.right}>{r.aimed ? formatHours(r.plan) : '–'}</td>
                <td className={styles.right}>
                  {r.aimed ? formatSignedHours(Math.round(r.balance)) : '–'}
                </td>
                <td className={styles.right}>
                  {r.averageWeek === null ? '–' : formatHours(r.averageWeek)}
                </td>
                {!contracts && <td className={styles.right}>{r.daysOff}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
