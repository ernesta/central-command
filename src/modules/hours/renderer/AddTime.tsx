import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@renderer/components/Button'
import { Select } from '@renderer/components/Select'
import { QUARTER } from '@shared/tracking/rounding'
import { DurationField } from './DurationField'
import { TaskField } from './TaskField'
import styles from './AddTime.module.css'

/** Time that was not tracked: a quiet "Add" that opens one inline row (task, hours:minutes). Escape closes it. */
export function AddTime({
  labels,
  clients = [],
  defaultClient,
  onAdd
}: {
  labels: readonly string[]
  /** The plan's clients (Work): the row then asks for one. */
  clients?: readonly string[]
  /** The client offered first. */
  defaultClient?: string
  onAdd: (label: string, minutes: number, client?: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const client = picked !== null && clients.includes(picked) ? picked : defaultClient
  const [label, setLabel] = useState('')
  const [minutes, setMinutes] = useState(0)
  const ready = label.trim() !== '' && minutes > 0

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
    setMinutes(0)
    setPicked(null)
  }
  const add = (): void => {
    if (!ready) return
    onAdd(label.trim(), Math.max(QUARTER, Math.round(minutes / QUARTER) * QUARTER), client)
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
      {clients.length > 0 && (
        <Select
          label="Client"
          value={client ?? clients[0]}
          options={clients.map((c) => ({ value: c, label: c }))}
          onChange={setPicked}
        />
      )}
      <DurationField label="Time" value={minutes} onChange={setMinutes} onEnter={add} />
      <Button variant="primary" disabled={!ready} onClick={add}>
        Add
      </Button>
    </div>
  )
}
