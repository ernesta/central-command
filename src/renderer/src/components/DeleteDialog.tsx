import { Button } from '@renderer/components/Button'
import { Dialog } from './Dialog'

interface DeleteDialogProps {
  open: boolean
  /** What is being deleted, for example "Supervision · Sep 24, 2026". */
  heading: string
  /** "meeting" or "training entry". */
  noun: string
  /** What goes with it, after "and all its": notes by default; a note says "text". */
  contents?: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** Asks before deleting a note (a meeting, a training entry). The file goes to the Trash, so this is calm rather than alarming. */
export function DeleteDialog({
  open,
  heading,
  noun,
  contents = 'notes',
  busy,
  onCancel,
  onConfirm
}: DeleteDialogProps): React.JSX.Element | null {
  if (!open) return null
  return (
    <Dialog
      title={`Delete this ${noun}?`}
      busy={busy}
      onCancel={onCancel}
      actions={
        <>
          <Button size="small" onClick={onCancel} disabled={busy} autoFocus>
            Cancel
          </Button>
          <Button size="small" variant="danger" onClick={onConfirm} disabled={busy}>
            Delete {noun}
          </Button>
        </>
      }
    >
      {heading} and all its {contents} will be removed from Central Command. The file moves to the
      macOS Trash, so you can still restore it from there.
    </Dialog>
  )
}
