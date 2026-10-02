import { X } from 'lucide-react'
import { formatDay } from '@shared/tracking/format'
import { timeOffRows } from '@shared/tracking/timeoff'
import { TIME_OFF_TYPES, type TrackingYear } from '@shared/tracking/types'
import type { HoursWorkspace } from '../../hours/shared/workspaces'
import styles from './TimeOffList.module.css'

const TYPE_LABELS = Object.fromEntries(TIME_OFF_TYPES.map((t) => [t.id, t.label]))

/** Every day off of the year, oldest first, with whether it is taken or still booked, and a button to remove it. */
export function TimeOffList({
  workspace,
  data,
  today
}: {
  workspace: HoursWorkspace
  data: TrackingYear
  today: string
}): React.JSX.Element | null {
  const rows = timeOffRows(data, today)
  if (rows.length === 0) return null

  return (
    <section className={styles.card} aria-label="Days off">
      <div className={styles.wrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className={styles.hidden}>Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date}>
                <td>{formatDay(row.date)}</td>
                <td>{TYPE_LABELS[row.type]}</td>
                <td className={row.taken ? styles.muted : undefined}>
                  {row.taken ? 'Taken' : 'Booked'}
                </td>
                <td className={styles.right}>
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={`Remove ${formatDay(row.date)}`}
                    title="Remove"
                    onClick={() =>
                      void window.api.tracking.removeTimeOff(workspace, data.start, row.date)
                    }
                  >
                    <X size={16} strokeWidth={1.75} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
