import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { Input } from '@renderer/components/Input'
import { FieldError } from '@renderer/components/FieldError'
import { Select } from '@renderer/components/Select'
import { inYear } from '@shared/year'
import { TIME_OFF_TYPES, type TimeOffType, type TrackingYear } from '@shared/tracking/types'
import type { HoursWorkspace } from '../../hours/shared/workspaces'
import styles from './AddTimeOff.module.css'

const REFUSED: Record<string, string> = {
  'outside-year': 'Those dates are outside this year.',
  backwards: 'To is before From.',
  weekend: 'That is a weekend.',
  listed: 'Those days are already listed.'
}

/** One inline row: from, to and the kind of day off. Weekends are skipped; Cancel or Escape closes it. */
export function AddTimeOff({
  workspace,
  data,
  today,
  onDone
}: {
  workspace: HoursWorkspace
  data: TrackingYear
  today: string
  onDone: () => void
}): React.JSX.Element {
  const first = inYear(today, data.start) ? today : data.start
  const [from, setFrom] = useState(first)
  // "To" follows "From" until it is typed.
  const [typedTo, setTypedTo] = useState<string | null>(null)
  const [type, setType] = useState<TimeOffType>('leave')
  const [error, setError] = useState<string | null>(null)
  const to = typedTo ?? from
  const ready = from !== '' && to !== ''

  const add = async (): Promise<void> => {
    if (!ready) return
    const result = await window.api.tracking.addTimeOff(workspace, data.start, from, to, type)
    if (result.ok) onDone()
    else setError(REFUSED[result.reason] ?? 'Couldn’t add those days.')
  }

  return (
    <div
      className={styles.box}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onDone()
        if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) void add()
      }}
    >
      <div className={styles.form}>
        <label className={styles.field}>
          <span className={styles.label}>From</span>
          <Input
            type="date"
            autoFocus
            value={from}
            onChange={(event) => {
              setFrom(event.target.value)
              setError(null)
            }}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>To</span>
          <Input
            type="date"
            value={to}
            onChange={(event) => {
              setTypedTo(event.target.value)
              setError(null)
            }}
          />
        </label>
        <div className={styles.field}>
          <span className={styles.label}>Type</span>
          <Select
            label="Type"
            value={type}
            options={TIME_OFF_TYPES.map((t) => ({ value: t.id, label: t.label }))}
            onChange={setType}
          />
        </div>
        <Button variant="primary" disabled={!ready} onClick={() => void add()}>
          Add
        </Button>
        <Button onClick={onDone}>Cancel</Button>
      </div>
      {error && <FieldError message={error} />}
    </div>
  )
}
