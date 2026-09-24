import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@renderer/components/Button'
import { Select } from '@renderer/components/Select'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { SERIES } from '../shared/types'
import { meetingRoute, todayIso } from './meetings-paths'
import styles from './NewMeetingButton.module.css'

/** "New meeting": pick a series and a date (today by default) and open the new meeting. */
export function NewMeetingButton(): React.JSX.Element {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [series, setSeries] = useState<string>(SERIES[0])
  const [date, setDate] = useState(todayIso())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent): void => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const create = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const file = await window.api.meetings.create({ workspace: 'research', series, date })
      void navigate(meetingRoute(file.ref.id))
    } catch (e) {
      setError(ipcErrorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <Button
        variant="primary"
        ref={buttonRef}
        aria-haspopup="dialog"
        aria-expanded={open}
        icon={<Plus size={14} strokeWidth={2} aria-hidden />}
        onClick={() => {
          setDate(todayIso())
          setOpen((o) => !o)
        }}
      >
        New meeting
      </Button>
      {open && (
        <form
          className={styles.popover}
          aria-label="New meeting"
          onSubmit={(event) => {
            event.preventDefault()
            void create()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false)
              buttonRef.current?.focus()
            }
          }}
        >
          <label className={styles.label} htmlFor="new-meeting-series">
            Series
          </label>
          <Select
            id="new-meeting-series"
            label="Series"
            value={series}
            options={SERIES.map((s) => ({ value: s as string, label: s }))}
            onChange={setSeries}
            autoFocus
          />
          <label className={styles.label} htmlFor="new-meeting-date">
            Date
          </label>
          <input
            id="new-meeting-date"
            type="date"
            className={styles.date}
            value={date}
            onChange={(event) => event.target.value && setDate(event.target.value)}
          />
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <Button variant="primary" type="submit" disabled={busy}>
            Create
          </Button>
        </form>
      )}
    </div>
  )
}
