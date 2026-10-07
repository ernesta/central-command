import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@renderer/components/Button'
import { QUARTER } from '@shared/tracking/rounding'
import type { HoursWorkspace } from '../shared/workspaces'
import { DurationField } from './DurationField'
import { TaskPicker, type PickedTask, type TaskPickerHandle } from './TaskPicker'
import styles from './AddTime.module.css'

/** Time that was not tracked: a quiet "Add" that opens one inline row (task, hours:minutes). Escape closes it. */
export function AddTime({
  workspace,
  clients = [],
  onAdd
}: {
  workspace: HoursWorkspace
  /** The plan's clients (Work): the task's client is one of them. */
  clients?: readonly string[]
  onAdd: (task: PickedTask, minutes: number) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const picker = useRef<TaskPickerHandle>(null)
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
  }
  const add = (): void => {
    if (ready) picker.current?.submit()
  }
  const picked = (task: PickedTask): void => {
    onAdd(task, Math.max(QUARTER, Math.round(minutes / QUARTER) * QUARTER))
    close()
  }

  return (
    <div
      className={styles.form}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close()
      }}
    >
      <TaskPicker
        ref={picker}
        autoFocus
        workspace={workspace}
        label="Task"
        placeholder="Task"
        value={label}
        onChange={setLabel}
        onPick={picked}
        clients={clients}
      />
      <DurationField label="Time" value={minutes} onChange={setMinutes} onEnter={add} />
      <Button variant="primary" disabled={!ready} onClick={add}>
        Add
      </Button>
    </div>
  )
}
