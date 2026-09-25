import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@renderer/components/Button'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { entryRoute, todayIso } from './training-paths'

/**
 * "New entry": creates an untitled entry for today at once and opens its page (with the title selected), where
 * everything is filled in at leisure.
 */
export function NewTrainingButton(): React.JSX.Element {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const file = await window.api.training.create({
        workspace: 'research',
        title: 'Untitled',
        date: todayIso()
      })
      void navigate(entryRoute(file.ref.id), { state: { isNew: true } })
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
        New entry
      </Button>
      {error && (
        <span role="alert" style={{ color: 'var(--danger)', fontSize: 'var(--text-13)' }}>
          {error}
        </span>
      )}
    </>
  )
}
