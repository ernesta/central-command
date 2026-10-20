import { Button } from '@renderer/components/Button'
import { Dialog } from '@renderer/components/Dialog'
import { formatDuration } from '@shared/time'

/** Asked only for a task with saved time: the time leaves Hours with it (Undo brings it back). */
export function DeleteTaskDialog({
  title,
  minutes,
  busy = false,
  onCancel,
  onConfirm
}: {
  title: string
  minutes: number
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}): React.JSX.Element {
  return (
    <Dialog
      title={`Delete “${title || 'Untitled'}”?`}
      onCancel={onCancel}
      busy={busy}
      actions={
        <>
          <Button size="small" autoFocus disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button size="small" variant="primary" disabled={busy} onClick={onConfirm}>
            Delete
          </Button>
        </>
      }
    >
      <p>{formatDuration(minutes)} of tracked time will be removed from Hours with it.</p>
    </Dialog>
  )
}
