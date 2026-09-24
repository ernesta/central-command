import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { findByName } from '../shared/people'
import type { Person } from '../shared/types'
import styles from './AttendeesField.module.css'

interface AttendeesFieldProps {
  attendees: string[]
  people: Person[]
  onChange: (attendees: string[]) => void
  /** Add a person to the people list (initials are worked out from the name). Rejects with a message. */
  onAddPerson: (name: string) => Promise<Person>
}

/** The meeting's attendees as initials chips, with a small menu to add people. */
export function AttendeesField({
  attendees,
  people,
  onChange,
  onAddPerson
}: AttendeesFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const close = (): void => {
    setOpen(false)
    setName('')
    setError(null)
    addRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent): void => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setName('')
        setError(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const attending = new Set(attendees.map((a) => a.toLowerCase()))
  const available = people.filter((p) => !attending.has(p.name.toLowerCase()))

  const add = (personName: string): void => {
    onChange([...attendees, personName])
    close()
  }

  const addNew = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      const person = await onAddPerson(trimmed)
      add(person.name)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message.replace(/^Error invoking remote method '[^']*': (Error: )?/, '')
          : String(e)
      )
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <ul className={styles.chips} aria-label="Attendees">
        {attendees.map((attendee) => {
          const person = findByName(people, attendee)
          return (
            <li
              key={attendee}
              className={[styles.chip, !person && styles.unknown].filter(Boolean).join(' ')}
            >
              <span title={person ? attendee : `${attendee} is not in your people list`}>
                {person ? person.initials : attendee}
              </span>
              <button
                type="button"
                className={styles.remove}
                aria-label={`Remove ${attendee}`}
                onClick={() => onChange(attendees.filter((a) => a !== attendee))}
              >
                <X size={12} strokeWidth={2} aria-hidden />
              </button>
            </li>
          )
        })}
        <li>
          <button
            ref={addRef}
            type="button"
            className={styles.add}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => {
              setOpen((o) => !o)
              setTimeout(() => inputRef.current?.focus(), 0)
            }}
          >
            <Plus size={12} strokeWidth={2} aria-hidden />
            add
          </button>
        </li>
      </ul>
      {open && (
        <div
          className={styles.popover}
          role="dialog"
          aria-label="Add an attendee"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              close()
            }
          }}
        >
          {available.length > 0 && (
            <ul className={styles.people}>
              {available.map((p) => (
                <li key={p.name}>
                  <button type="button" className={styles.person} onClick={() => add(p.name)}>
                    <span className={styles.initials}>{p.initials}</span>
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className={styles.newPerson}
            onSubmit={(event) => {
              event.preventDefault()
              void addNew()
            }}
          >
            <label className={styles.newLabel} htmlFor="new-person">
              {available.length > 0 ? 'Someone new' : 'Add someone'}
            </label>
            <div className={styles.newRow}>
              <input
                id="new-person"
                ref={inputRef}
                className={styles.input}
                value={name}
                placeholder="Full name"
                onChange={(event) => {
                  setName(event.target.value)
                  setError(null)
                }}
              />
              <button type="submit" className={styles.submit} disabled={name.trim() === ''}>
                Add
              </button>
            </div>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
