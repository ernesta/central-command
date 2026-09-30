import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@renderer/components/Button'
import { Dialog } from '@renderer/components/Dialog'
import { PeopleError, updatePerson } from '@shared/people'
import type { PersonPatch } from '../shared/people'
import { personRoute } from './meetings-paths'
import { changeSentences } from '../shared/people-copy'
import type { PersonUsage } from '../shared/people-usage'
import type { Person } from '../shared/types'
import styles from './PeopleTable.module.css'

/** Resolves with an error message, or null when the change went through. */
export type Save = (name: string, patch: PersonPatch) => Promise<string | null>

function submitOrCancel(submit: () => void, cancel: () => void) {
  return (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' && event.key !== 'Escape') return
    // Without this, the Enter that opens a dialog would also press the button the dialog focuses.
    event.preventDefault()
    if (event.key === 'Enter') submit()
    else cancel()
  }
}

/** Which input a refusal is about: the initials, or otherwise the name. */
const isInitialsProblem = (message: string): boolean => /initials/i.test(message)

function FieldError({ message }: { message: string }): React.JSX.Element {
  return (
    <p className={styles.error} role="alert">
      {message}
    </p>
  )
}

function changeTitle(nameChanged: boolean, initialsChanged: boolean): string {
  if (nameChanged && initialsChanged) return 'Change name and initials?'
  return nameChanged ? 'Change name?' : 'Change initials?'
}

interface RowProps {
  person: Person
  usage: PersonUsage | undefined
  editing: boolean
  onEdit: () => void
  onDone: () => void
  onSave: Save
  /** The reason a change would be refused (taken initials, a blank name), or null. */
  check: (name: string, patch: PersonPatch) => string | null
  /** Leave out for someone who cannot be removed (you). */
  onRemove?: () => void
  /** Given for archived people, who can only be restored. */
  onRestore?: () => void
  /** Scrolled to and given a lasting tint: opened from a search hit for this person. */
  highlighted?: boolean
}

function PersonRow({
  person,
  usage,
  editing,
  onEdit,
  onDone,
  onSave,
  check,
  onRemove,
  onRestore,
  highlighted
}: RowProps): React.JSX.Element {
  const [name, setName] = useState(person.name)
  const [initials, setInitials] = useState(person.initials)
  const [me, setMe] = useState(person.me)
  const [confirming, setConfirming] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const rowRef = useRef<HTMLTableRowElement>(null)

  useEffect(() => {
    if (highlighted) rowRef.current?.scrollIntoView({ block: 'center' })
  }, [highlighted])

  const patch: PersonPatch = {}
  if (name.trim().replace(/\s+/g, ' ') !== person.name) patch.name = name
  if (initials.trim().toUpperCase() !== person.initials) patch.initials = initials
  if (me !== person.me) patch.me = me
  const nameChanged = patch.name !== undefined
  const initialsChanged = patch.initials !== undefined
  const sentences = changeSentences(usage, nameChanged, initialsChanged)

  const save = async (): Promise<void> => {
    setConfirming(false)
    if (Object.keys(patch).length === 0) return onDone()
    const refused = await onSave(person.name, patch)
    if (refused === null) onDone()
    else setProblem(refused)
  }
  const submit = (): void => {
    const refused = check(person.name, patch)
    if (refused) return setProblem(refused)
    if (sentences.length > 0) setConfirming(true)
    else void save()
  }
  const cancel = (): void => {
    setName(person.name)
    setInitials(person.initials)
    setMe(person.me)
    setProblem(null)
    onDone()
  }

  if (!editing) {
    return (
      <tr
        ref={rowRef}
        className={[styles.row, highlighted && styles.highlighted].filter(Boolean).join(' ')}
      >
        <td>
          <Link className={styles.nameLink} to={personRoute(person.name)}>
            {person.name}
          </Link>
          {person.me && <span className={styles.me}> (me)</span>}
        </td>
        <td>
          <span className={styles.chip}>{person.initials}</span>
        </td>
        <td className={styles.count}>{usage?.meetings ?? 0}</td>
        <td className={styles.count}>{usage?.trainings ?? 0}</td>
        <td className={styles.actions}>
          {onRestore ? (
            <Button size="small" aria-label={`Restore ${person.name}`} onClick={onRestore}>
              Restore
            </Button>
          ) : (
            <>
              <Button size="small" aria-label={`Edit ${person.name}`} onClick={onEdit}>
                Edit
              </Button>
              {onRemove && (
                <Button size="small" aria-label={`Remove ${person.name}`} onClick={onRemove}>
                  Remove
                </Button>
              )}
            </>
          )}
        </td>
      </tr>
    )
  }

  return (
    <tr className={styles.row}>
      <td>
        <input
          className={styles.input}
          value={name}
          aria-label={`Name of ${person.name}`}
          autoFocus
          onChange={(event) => {
            setName(event.target.value)
            setProblem(null)
          }}
          onKeyDown={submitOrCancel(submit, cancel)}
        />
        {problem && !isInitialsProblem(problem) && <FieldError message={problem} />}
      </td>
      <td>
        <input
          className={`${styles.input} ${styles.initials}`}
          value={initials}
          maxLength={6}
          aria-label={`Initials of ${person.name}`}
          onChange={(event) => {
            setInitials(event.target.value)
            setProblem(null)
          }}
          onKeyDown={submitOrCancel(submit, cancel)}
        />
        {problem && isInitialsProblem(problem) && <FieldError message={problem} />}
      </td>
      <td className={styles.count}>{usage?.meetings ?? 0}</td>
      <td className={styles.count}>{usage?.trainings ?? 0}</td>
      <td className={styles.actions}>
        <Button
          size="small"
          className={styles.meButton}
          aria-pressed={me}
          onClick={() => setMe(!me)}
        >
          {me ? 'This is me' : 'Set as me'}
        </Button>
        <Button size="small" variant="primary" onClick={submit}>
          Save
        </Button>
        <Button size="small" onClick={cancel}>
          Cancel
        </Button>
        {confirming && (
          <Dialog
            title={changeTitle(nameChanged, initialsChanged)}
            onCancel={() => setConfirming(false)}
            actions={
              <>
                <Button size="small" autoFocus onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button size="small" variant="primary" onClick={() => void save()}>
                  Change
                </Button>
              </>
            }
          >
            {sentences.join(' ')}
          </Dialog>
        )}
      </td>
    </tr>
  )
}

interface AddRowProps {
  /** Resolves with an error message, or null when the person was added. */
  onAdd: (name: string, initials: string) => Promise<string | null>
  onDone: () => void
}

function AddRow({ onAdd, onDone }: AddRowProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [initials, setInitials] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const submit = async (): Promise<void> => {
    if (name.trim() === '') return
    const refused = await onAdd(name, initials)
    if (refused === null) onDone()
    else setProblem(refused)
  }
  const keys = submitOrCancel(() => void submit(), onDone)
  return (
    <tr className={styles.row}>
      <td>
        <input
          className={styles.input}
          value={name}
          placeholder="Full name"
          aria-label="Name of the new person"
          autoFocus
          onChange={(event) => {
            setName(event.target.value)
            setProblem(null)
          }}
          onKeyDown={keys}
        />
        {problem && !isInitialsProblem(problem) && <FieldError message={problem} />}
      </td>
      <td>
        <input
          className={`${styles.input} ${styles.initials}`}
          value={initials}
          maxLength={6}
          placeholder="Auto"
          aria-label="Initials of the new person"
          onChange={(event) => {
            setInitials(event.target.value)
            setProblem(null)
          }}
          onKeyDown={keys}
        />
        {problem && isInitialsProblem(problem) && <FieldError message={problem} />}
      </td>
      <td className={styles.count} />
      <td className={styles.count} />
      <td className={styles.actions}>
        <Button
          size="small"
          variant="primary"
          disabled={name.trim() === ''}
          onClick={() => void submit()}
        >
          Add
        </Button>
        <Button size="small" onClick={onDone}>
          Cancel
        </Button>
      </td>
    </tr>
  )
}

interface PeopleTableProps {
  /** The people shown in this table. */
  people: readonly Person[]
  /** Everyone, archived people included: their initials are taken. */
  everyone: readonly Person[]
  usage: readonly PersonUsage[]
  /** Show a row for a new person at the top (with `onAdd` and `onAddDone`). */
  adding?: boolean
  onAdd?: AddRowProps['onAdd']
  onAddDone?: () => void
  onSave: Save
  onRemove?: (person: Person) => void
  /** Makes this the table of archived people: each row offers Restore instead of Edit and Remove. */
  onRestore?: (person: Person) => void
  /** The person to scroll to and tint, opened from a search hit. */
  highlighted?: string | null
}

/** The people list as a table: name, initials, how many meetings and trainings mention them, and what you can do. */
export function PeopleTable({
  people,
  everyone,
  usage,
  adding,
  onAdd,
  onAddDone,
  onSave,
  onRemove,
  onRestore,
  highlighted
}: PeopleTableProps): React.JSX.Element {
  const [editing, setEditing] = useState<string | null>(null)
  return (
    <div className={styles.card}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Name</th>
            <th className={styles.th}>Initials</th>
            <th className={styles.th}>Meetings</th>
            <th className={styles.th}>Trainings</th>
            <th className={styles.th}>
              <span className={styles.hidden}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {adding && onAdd && onAddDone && <AddRow onAdd={onAdd} onDone={onAddDone} />}
          {people.map((person) => (
            <PersonRow
              // A renamed person is a new row, so a stale edit draft never carries over.
              key={`${person.name}|${person.initials}|${person.me}`}
              person={person}
              usage={usage.find((u) => u.name === person.name)}
              editing={editing === person.name}
              onEdit={() => setEditing(person.name)}
              onDone={() => setEditing(null)}
              onSave={onSave}
              check={(name, patch) => {
                try {
                  updatePerson(everyone, name, patch)
                  return null
                } catch (error) {
                  if (error instanceof PeopleError) return error.message
                  throw error
                }
              }}
              onRemove={onRemove && !person.me ? () => onRemove(person) : undefined}
              onRestore={onRestore ? () => onRestore(person) : undefined}
              highlighted={highlighted === person.name}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
