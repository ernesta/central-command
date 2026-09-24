import { useEffect, useRef } from 'react'
import { Button } from '@renderer/components/Button'
import styles from './DeleteDialog.module.css'

interface DeleteDialogProps {
  open: boolean
  /** "Supervision · Sep 24, 2026" */
  heading: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** Asks before deleting a meeting. The file goes to the Trash, so this is calm rather than alarming. */
export function DeleteDialog({
  open,
  heading,
  busy,
  onCancel,
  onConfirm
}: DeleteDialogProps): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="delete-meeting-title"
      aria-describedby="delete-meeting-text"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
    >
      <h2 id="delete-meeting-title" className={styles.title}>
        Delete this meeting?
      </h2>
      <p id="delete-meeting-text" className={styles.text}>
        {heading} and all its notes will be removed from Central Command. The file moves to the
        macOS Trash, so you can still restore it from there.
      </p>
      <div className={styles.actions}>
        <Button size="small" onClick={onCancel} disabled={busy} autoFocus>
          Cancel
        </Button>
        <Button size="small" className={styles.danger} onClick={onConfirm} disabled={busy}>
          Delete meeting
        </Button>
      </div>
    </dialog>
  )
}
