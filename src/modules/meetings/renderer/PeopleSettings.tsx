import { useEffect, useState } from 'react'
import { Button } from '@renderer/components/Button'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import type { PersonPatch } from '../shared/people'
import type { Person } from '../shared/types'
import styles from './PeopleSettings.module.css'

interface RowProps {
  person: Person
  /** Resolves with an error message, or null when the change was accepted. */
  onChange: (name: string, patch: PersonPatch) => Promise<string | null>
  onRemove: (name: string) => Promise<string | null>
}

function PersonRow({ person, onChange, onRemove }: RowProps): React.JSX.Element {
  // A draft is what the user has typed but not saved; null means "show the saved value".
  const [draftName, setDraftName] = useState<string | null>(null)
  const [draftInitials, setDraftInitials] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const name = draftName ?? person.name
  const initials = draftInitials ?? person.initials

  const commit = async (patch: PersonPatch, clear: () => void): Promise<void> => {
    const message = await onChange(person.name, patch)
    setError(message)
    if (!message) clear()
  }
  const commitName = (): void => {
    if (draftName === null) return
    if (draftName.trim() === person.name) setDraftName(null)
    else void commit({ name: draftName }, () => setDraftName(null))
  }
  const commitInitials = (): void => {
    if (draftInitials === null) return
    if (draftInitials.trim().toUpperCase() === person.initials) setDraftInitials(null)
    else void commit({ initials: draftInitials }, () => setDraftInitials(null))
  }
  const submitOnEnter = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') event.currentTarget.blur()
  }

  return (
    <li className={styles.row}>
      <input
        className={styles.input}
        value={name}
        aria-label={`Name of ${person.name}`}
        onChange={(event) => setDraftName(event.target.value)}
        onBlur={commitName}
        onKeyDown={submitOnEnter}
      />
      <input
        className={`${styles.input} ${styles.initials}`}
        value={initials}
        maxLength={6}
        aria-label={`Initials of ${person.name}`}
        onChange={(event) => setDraftInitials(event.target.value)}
        onBlur={commitInitials}
        onKeyDown={submitOnEnter}
      />
      <label className={styles.me}>
        <input
          type="checkbox"
          checked={person.me}
          onChange={(event) => void commit({ me: event.target.checked }, () => undefined)}
        />
        This is me
      </label>
      {confirming ? (
        <span className={styles.confirm}>
          <Button
            size="small"
            className={styles.danger}
            onClick={() => void onRemove(person.name).then((message) => setError(message))}
          >
            Remove {person.name}
          </Button>
          <Button size="small" onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </span>
      ) : (
        <Button
          size="small"
          aria-label={`Remove ${person.name}`}
          onClick={() => setConfirming(true)}
        >
          Remove
        </Button>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </li>
  )
}

/**
 * The people you meet with: full name, unique initials (used for attendees and TODO owners) and which one is
 * you. Meeting files record attendees by full name, so renaming or removing someone changes the list only.
 */
export function PeopleSettings(): React.JSX.Element {
  const [people, setPeople] = useState<Person[] | null>(null)
  const [newName, setNewName] = useState('')
  const [newInitials, setNewInitials] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.meetings.people.list().then((list) => {
      if (!cancelled) setPeople(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const run = async (action: Promise<Person[]>): Promise<string | null> => {
    try {
      setPeople(await action)
      return null
    } catch (error) {
      return ipcErrorMessage(error)
    }
  }

  const add = async (): Promise<void> => {
    const message = await run(
      window.api.meetings.people.add({ name: newName, initials: newInitials || undefined })
    )
    setAddError(message)
    if (!message) {
      setNewName('')
      setNewInitials('')
    }
  }

  return (
    <section className={styles.card} aria-labelledby="people-title">
      <h2 id="people-title" className={styles.title}>
        People
      </h2>
      <p className={styles.help}>
        Initials must be different for everyone. Meeting files record attendees by full name, so
        renaming or removing someone changes this list only; existing meetings keep the name they
        have. Marking yourself as “me” turns on the Mine view of open TODOs.
      </p>
      {people !== null && people.length === 0 && (
        <p className={styles.empty}>Nobody yet. People you add to a meeting appear here too.</p>
      )}
      {people !== null && people.length > 0 && (
        <ul className={styles.list}>
          <li className={`${styles.row} ${styles.head}`} aria-hidden>
            <span>Name</span>
            <span>Initials</span>
            <span />
            <span />
          </li>
          {people.map((person, index) => (
            <PersonRow
              key={index}
              person={person}
              onChange={(name, patch) => run(window.api.meetings.people.update(name, patch))}
              onRemove={(name) => run(window.api.meetings.people.remove(name))}
            />
          ))}
        </ul>
      )}
      <form
        className={styles.add}
        onSubmit={(event) => {
          event.preventDefault()
          void add()
        }}
      >
        <input
          className={styles.input}
          value={newName}
          aria-label="Name of the new person"
          placeholder="Full name"
          onChange={(event) => setNewName(event.target.value)}
        />
        <input
          className={`${styles.input} ${styles.initials}`}
          value={newInitials}
          maxLength={6}
          aria-label="Initials of the new person"
          placeholder="Auto"
          onChange={(event) => setNewInitials(event.target.value)}
        />
        <Button type="submit" variant="primary" disabled={newName.trim() === ''}>
          Add person
        </Button>
        {addError && (
          <p className={styles.error} role="alert">
            {addError}
          </p>
        )}
      </form>
    </section>
  )
}
