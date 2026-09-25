import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { activePeople, findByName, type Person } from '@shared/people'
import styles from './PeopleField.module.css'

interface PeopleFieldProps {
  /** What the people are called, plural: "Attendees", "Leads". */
  label: string
  /** The same in the singular and lower case, for the menu: "attendee", "lead". */
  noun: string
  names: string[]
  people: Person[]
  onChange: (names: string[]) => void
  /** Add a person to the people list (initials are worked out from the name). Rejects with a message. */
  onAddPerson: (name: string) => Promise<Person>
}

/** People as initials chips (Meetings attendees, Training leads), with a small menu to add people. */
export function PeopleField({
  label,
  noun,
  names,
  people,
  onChange,
  onAddPerson
}: PeopleFieldProps): React.JSX.Element {
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

  const attending = new Set(names.map((a) => a.toLowerCase()))
  const available = activePeople(people).filter((p) => !attending.has(p.name.toLowerCase()))

  const add = (personName: string): void => {
    onChange([...names, personName])
    close()
  }

  const addNew = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      const person = await onAddPerson(trimmed)
      add(person.name)
    } catch (e) {
      setError(ipcErrorMessage(e))
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <ul className={styles.chips} aria-label={label}>
        {names.map((name) => {
          const person = findByName(people, name)
          return (
            <li
              key={name}
              className={[styles.chip, !person && styles.unknown].filter(Boolean).join(' ')}
            >
              <span title={person ? name : `${name} is not in your people list`}>
                {person ? person.initials : name}
              </span>
              <button
                type="button"
                className={styles.remove}
                aria-label={`Remove ${name}`}
                onClick={() => onChange(names.filter((a) => a !== name))}
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
          aria-label={`Add ${noun === 'attendee' ? 'an' : 'a'} ${noun}`}
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
