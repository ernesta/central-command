import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { Input } from '@renderer/components/Input'
import { Notice } from '@renderer/components/Notice'
import { Select } from '@renderer/components/Select'
import { formatDay } from '@shared/tracking/format'
import { timeOffRows, type TimeOffRow } from '@shared/tracking/timeoff'
import { TIME_OFF_TYPES, type TimeOffType, type TrackingYear } from '@shared/tracking/types'
import type { HoursWorkspace } from '../../hours/shared/workspaces'
import styles from './TimeOffList.module.css'

const REFUSED: Record<string, string> = {
  'outside-year': 'That date is outside this year.',
  weekend: 'That is a weekend.',
  listed: 'That day is already listed.'
}

const TYPE_OPTIONS = TIME_OFF_TYPES.map((t) => ({ value: t.id, label: t.label }))
const TYPE_LABELS = Object.fromEntries(TIME_OFF_TYPES.map((t) => [t.id, t.label]))

function DayRow({
  row,
  editing,
  onEdit,
  onDone,
  onSave,
  onRemove
}: {
  row: TimeOffRow
  editing: boolean
  onEdit: () => void
  onDone: () => void
  /** Resolves with an error message, or null when the change went through. */
  onSave: (date: string, type: TimeOffType) => Promise<string | null>
  onRemove: () => void
}): React.JSX.Element {
  const [date, setDate] = useState(row.date)
  const [type, setType] = useState<TimeOffType>(row.type)
  const [problem, setProblem] = useState<string | null>(null)
  const status = (
    <td className={row.taken ? styles.muted : undefined}>{row.taken ? 'Taken' : 'Booked'}</td>
  )

  if (!editing)
    return (
      <tr>
        <td>{formatDay(row.date)}</td>
        <td>{TYPE_LABELS[row.type]}</td>
        {status}
        <td className={styles.actions}>
          <Button size="small" aria-label={`Edit ${formatDay(row.date)}`} onClick={onEdit}>
            Edit
          </Button>
          <Button size="small" aria-label={`Remove ${formatDay(row.date)}`} onClick={onRemove}>
            Remove
          </Button>
        </td>
      </tr>
    )

  const cancel = (): void => {
    setDate(row.date)
    setType(row.type)
    setProblem(null)
    onDone()
  }
  const save = async (): Promise<void> => {
    if (date === '') return
    if (date === row.date && type === row.type) return onDone()
    const refused = await onSave(date, type)
    if (refused === null) onDone()
    else setProblem(refused)
  }
  return (
    <tr
      onKeyDown={(event) => {
        if (event.key === 'Escape') cancel()
        if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) void save()
      }}
    >
      <td>
        <Input
          type="date"
          autoFocus
          aria-label={`Date of ${formatDay(row.date)}`}
          value={date}
          onChange={(event) => {
            setDate(event.target.value)
            setProblem(null)
          }}
        />
        {problem && <Notice tone="error">{problem}</Notice>}
      </td>
      <td>
        <Select
          label={`Type of ${formatDay(row.date)}`}
          value={type}
          options={TYPE_OPTIONS}
          onChange={setType}
        />
      </td>
      {status}
      <td className={styles.actions}>
        <Button size="small" variant="primary" onClick={() => void save()}>
          Save
        </Button>
        <Button size="small" onClick={cancel}>
          Cancel
        </Button>
      </td>
    </tr>
  )
}

/** Every day off of the year, oldest first, with whether it is taken or still booked; each row has Edit and Remove. */
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
  const [editing, setEditing] = useState<string | null>(null)
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
                <span className={styles.hidden}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <DayRow
                // A moved or retyped day is a new row, so a stale edit draft never carries over.
                key={`${row.date}|${row.type}`}
                row={row}
                editing={editing === row.date}
                onEdit={() => setEditing(row.date)}
                onDone={() => setEditing(null)}
                onSave={async (date, type) => {
                  const result = await window.api.tracking.editTimeOff(
                    workspace,
                    data.start,
                    row.date,
                    date,
                    type
                  )
                  return result.ok ? null : (REFUSED[result.reason] ?? 'Could not save that day.')
                }}
                onRemove={() =>
                  void window.api.tracking.removeTimeOff(workspace, data.start, row.date)
                }
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
