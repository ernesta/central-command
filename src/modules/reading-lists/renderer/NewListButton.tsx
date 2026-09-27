import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@renderer/components/Button'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { readingListRoute } from './reading-lists-paths'

/**
 * "New list": creates an untitled list at once and opens its page with the cursor in the title, where
 * its sections and entries are filled in at leisure.
 */
export function NewListButton(): React.JSX.Element {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const file = await window.api.readingLists.create({ workspace: 'research' })
      void navigate(readingListRoute(file.ref.id), { state: { isNew: true } })
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
        onClick={() => void create()}
      >
        New list
      </Button>
      {error && (
        <span role="alert" style={{ color: 'var(--danger)', fontSize: 'var(--text-13)' }}>
          {error}
        </span>
      )}
    </>
  )
}
