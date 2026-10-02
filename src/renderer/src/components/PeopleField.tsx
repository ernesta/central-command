import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { activePeople, findByName, matchPeople, sortPeople, type Person } from '@shared/people'
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
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const close = (): void => {
    setOpen(false)
    setName('')
    setActive(0)
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
  const available = sortPeople(
    activePeople(people).filter((p) => !attending.has(p.name.toLowerCase()))
  )
  const trimmed = name.trim()
  const matches = matchPeople(available, trimmed)
  const exists =
    trimmed !== '' && people.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())
  // Typing a name nobody has yet offers to add them, in the same list.
  const offerNew = trimmed !== '' && !exists
  const rows = matches.length + (offerNew ? 1 : 0)
  const current = Math.min(active, Math.max(rows - 1, 0))

  const add = (personName: string): void => {
    onChange([...names, personName])
    close()
  }

  const addNew = async (): Promise<void> => {
    if (!trimmed) return
    try {
      const person = await onAddPerson(trimmed)
      add(person.name)
    } catch (e) {
      setError(ipcErrorMessage(e))
    }
  }

  const choose = (index: number): void => {
    if (index < matches.length) add(matches[index].name)
    else if (offerNew) void addNew()
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
          <input
            id="person-search"
            ref={inputRef}
            className={styles.input}
            value={name}
            placeholder="Search or add"
            aria-label={`Search or add ${noun === 'attendee' ? 'an' : 'a'} ${noun}`}
            autoComplete="off"
            onChange={(event) => {
              setName(event.target.value)
              setActive(0)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                if (rows > 0)
                  setActive((current + (event.key === 'ArrowDown' ? 1 : rows - 1)) % rows)
              } else if (event.key === 'Enter') {
                event.preventDefault()
                choose(current)
              }
            }}
          />
          {rows > 0 && (
            <ul className={styles.people}>
              {matches.map((p, index) => (
                <li key={p.name}>
                  <button
                    type="button"
                    className={[styles.person, index === current && styles.current]
                      .filter(Boolean)
                      .join(' ')}
                    ref={(el) => {
                      if (el && index === current) el.scrollIntoView({ block: 'nearest' })
                    }}
                    onClick={() => add(p.name)}
                  >
                    <span className={styles.initials}>{p.initials}</span>
                    {p.name}
                  </button>
                </li>
              ))}
              {offerNew && (
                <li>
                  <button
                    type="button"
                    className={[styles.person, current === matches.length && styles.current]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => void addNew()}
                  >
                    <Plus size={12} strokeWidth={2} aria-hidden />
                    Add “{trimmed}”
                  </button>
                </li>
              )}
            </ul>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
