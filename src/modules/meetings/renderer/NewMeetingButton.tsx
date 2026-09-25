import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@renderer/components/Button'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { SERIES } from '../shared/types'
import { meetingRoute, todayIso } from './meetings-paths'

/**
 * "New meeting": creates a meeting for today at once and opens its page, where the series, date, times and
 * everything else are filled in at leisure.
 */
export function NewMeetingButton(): React.JSX.Element {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const file = await window.api.meetings.create({
        workspace: 'research',
        series: SERIES[0],
        date: todayIso()
      })
      void navigate(meetingRoute(file.ref.id))
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
        New meeting
      </Button>
      {error && (
        <span role="alert" style={{ color: 'var(--danger)', fontSize: 'var(--text-13)' }}>
          {error}
        </span>
      )}
    </>
  )
}
