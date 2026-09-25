import { useEffect, useRef, type ReactNode } from 'react'
import styles from './Dialog.module.css'

interface DialogProps {
  title: string
  /** A short sentence, or the choices (radios, a select) the dialog asks for. */
  children?: ReactNode
  /** The buttons, Cancel first. */
  actions: ReactNode
  /** Escape closes the dialog through this, unless `busy`. */
  onCancel: () => void
  busy?: boolean
}

/**
 * A modal dialog, shown as soon as it is rendered: render it only while it is wanted. Cancel should be the
 * first control and carry `autoFocus`, so Enter never confirms something by accident.
 */
export function Dialog({
  title,
  children,
  actions,
  onCancel,
  busy = false
}: DialogProps): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
    >
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.text}>{children}</div>
      <div className={styles.actions}>{actions}</div>
    </dialog>
  )
}
