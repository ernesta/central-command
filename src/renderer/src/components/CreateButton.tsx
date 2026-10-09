import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import styles from './CreateButton.module.css'

interface CreateButtonProps {
  /** "New note", "New meeting". */
  children: string
  /** Makes the item and opens its page; a refusal is shown beside the button. */
  create: () => Promise<void>
}

/** The primary "New …" button of a landing or list page: creates the item at once, then the page opens. */
export function CreateButton({ children, create }: CreateButtonProps): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await create()
    } catch (e) {
      setError(ipcErrorMessage(e))
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        variant="primary"
        disabled={busy}
        icon={<Plus size={14} strokeWidth={2} aria-hidden />}
        onClick={() => void run()}
      >
        {children}
      </Button>
      {error && (
        <span role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </>
  )
}
