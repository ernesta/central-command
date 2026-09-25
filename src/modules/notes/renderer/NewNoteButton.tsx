import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@renderer/components/Button'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { noteRoute } from './notes-paths'

/**
 * "New note": creates an untitled note at once and opens its page with the cursor in the title, where the group
 * and everything else are filled in at leisure. On a group's page the note starts in that group.
 */
export function NewNoteButton({
  group = '',
  subgroup = ''
}: {
  group?: string
  subgroup?: string
}): React.JSX.Element {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const file = await window.api.notes.create({ workspace: 'research', group, subgroup })
      void navigate(noteRoute(file.ref.id), { state: { focus: 'title' } })
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
        New note
      </Button>
      {error && (
        <span role="alert" style={{ color: 'var(--danger)', fontSize: 'var(--text-13)' }}>
          {error}
        </span>
      )}
    </>
  )
}
