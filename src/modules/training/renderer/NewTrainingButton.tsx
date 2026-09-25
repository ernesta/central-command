import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@renderer/components/Button'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { entryRoute, todayIso } from './training-paths'
import styles from './NewTrainingButton.module.css'

/** "New entry": a title and a date (today by default), then open the new entry. */
export function NewTrainingButton(): React.JSX.Element {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
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
      const file = await window.api.training.create({
        workspace: 'research',
        title: title.trim() || 'Untitled',
        date
      })
      void navigate(entryRoute(file.ref.id))
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
          setTitle('')
          setBusy(false)
          setOpen((o) => !o)
        }}
      >
        New entry
      </Button>
      {open && (
        <form
          className={styles.popover}
          aria-label="New training entry"
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
          <label className={styles.label} htmlFor="new-training-title">
            Title
          </label>
          <input
            id="new-training-title"
            className={styles.input}
            value={title}
            placeholder="What was it?"
            autoFocus
            onChange={(event) => setTitle(event.target.value.replace(/[\r\n]/g, ' '))}
          />
          <label className={styles.label} htmlFor="new-training-date">
            Date
          </label>
          <input
            id="new-training-date"
            type="date"
            className={styles.input}
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
