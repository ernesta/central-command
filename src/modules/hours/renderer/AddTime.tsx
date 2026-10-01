import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@renderer/components/Button'
import { Input } from '@renderer/components/Input'
import { parseQuarterHours } from '../shared/tasks'
import { TaskField } from './TaskField'
import styles from './AddTime.module.css'

/** Time that was not tracked: a quiet "Add" that opens one inline row (task, hours:minutes). Escape closes it. */
export function AddTime({
  labels,
  onAdd
}: {
  labels: readonly string[]
  onAdd: (label: string, minutes: number) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [time, setTime] = useState('')
  const minutes = parseQuarterHours(time)
  const ready = label.trim() !== '' && minutes !== null && minutes > 0

  if (!open) {
    return (
      <button type="button" className={styles.quiet} onClick={() => setOpen(true)}>
        <Plus size={16} strokeWidth={1.75} aria-hidden />
        Add
      </button>
    )
  }

  const close = (): void => {
    setOpen(false)
    setLabel('')
    setTime('')
  }
  const add = (): void => {
    if (!ready) return
    onAdd(label.trim(), minutes)
    close()
  }

  return (
    <div
      className={styles.form}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close()
      }}
    >
      <TaskField
        autoFocus
        label="Task"
        placeholder="Task"
        value={label}
        onChange={setLabel}
        onSubmit={add}
        labels={labels}
      />
      <Input
        className={styles.time}
        aria-label="Time"
        placeholder="0:00"
        inputMode="numeric"
        aria-invalid={(time !== '' && minutes === null) || undefined}
        value={time}
        onChange={(event) => setTime(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            add()
          }
        }}
      />
      <Button variant="primary" disabled={!ready} onClick={add}>
        Add
      </Button>
    </div>
  )
}
