import { X } from 'lucide-react'
import { useState } from 'react'
import { Input } from '@renderer/components/Input'
import { Notice } from '@renderer/components/Notice'
import { Select } from '@renderer/components/Select'
import { formatDay } from '@shared/tracking/format'
import { timeOffRows } from '@shared/tracking/timeoff'
import { TIME_OFF_TYPES, type TrackingYear } from '@shared/tracking/types'
import type { HoursWorkspace } from '../../hours/shared/workspaces'
import styles from './TimeOffList.module.css'

const REFUSED: Record<string, string> = {
  'outside-year': 'That date is outside this year.',
  weekend: 'That is a weekend.',
  listed: 'That day is already listed.'
}

const TYPE_OPTIONS = TIME_OFF_TYPES.map((t) => ({ value: t.id, label: t.label }))

/** Every day off of the year, oldest first, with its type (changeable), whether it is taken or still booked, and a button to remove it. */
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
  const [error, setError] = useState<string | null>(null)
  if (rows.length === 0) return null

  const move = async (from: string, to: string): Promise<void> => {
    if (to === '') return
    const result = await window.api.tracking.moveTimeOff(workspace, data.start, from, to)
    setError(result.ok ? null : (REFUSED[result.reason] ?? 'Could not move that day.'))
  }

  return (
    <section className={styles.card} aria-label="Days off">
      {error && <Notice tone="error">{error}</Notice>}
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
                <td>
                  <Input
                    type="date"
                    aria-label={`Date of ${formatDay(row.date)}`}
                    value={row.date}
                    onChange={(event) => void move(row.date, event.target.value)}
                  />
                </td>
                <td>
                  <Select
                    label={`Type of ${formatDay(row.date)}`}
                    value={row.type}
                    options={TYPE_OPTIONS}
                    onChange={(type) =>
                      void window.api.tracking.setTimeOffType(workspace, data.start, row.date, type)
                    }
                  />
                </td>
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
