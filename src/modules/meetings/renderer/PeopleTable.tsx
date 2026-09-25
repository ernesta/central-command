import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { Dialog } from '@renderer/components/Dialog'
import { PeopleError, updatePerson } from '@shared/people'
import type { PersonPatch } from '../shared/people'
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

/** The sentence the Change dialog shows: only what the edit will change in the notes. */
function changeText(nameChanged: boolean, initialsChanged: boolean): string {
  return [
    nameChanged && 'This will update the name in meetings and trainings.',
    initialsChanged && 'Initials in TODOs will change.'
  ]
    .filter(Boolean)
    .join(' ')
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
  onInvalid: (message: string) => void
  /** Leave out for someone who cannot be removed (you). */
  onRemove?: () => void
  /** Given for archived people, who can only be restored. */
  onRestore?: () => void
}

function PersonRow({
  person,
  usage,
  editing,
  onEdit,
  onDone,
  onSave,
  check,
  onInvalid,
  onRemove,
  onRestore
}: RowProps): React.JSX.Element {
  const [name, setName] = useState(person.name)
  const [initials, setInitials] = useState(person.initials)
  const [me, setMe] = useState(person.me)
  const [confirming, setConfirming] = useState(false)
  const mentioned = (usage?.meetings ?? 0) + (usage?.trainings ?? 0) > 0

  const patch: PersonPatch = {}
  if (name.trim().replace(/\s+/g, ' ') !== person.name) patch.name = name
  if (initials.trim().toUpperCase() !== person.initials) patch.initials = initials
  if (me !== person.me) patch.me = me
  const nameChanged = patch.name !== undefined
  const initialsChanged = patch.initials !== undefined

  const save = async (): Promise<void> => {
    setConfirming(false)
    if (Object.keys(patch).length === 0) return onDone()
    if ((await onSave(person.name, patch)) === null) onDone()
  }
  const submit = (): void => {
    const problem = check(person.name, patch)
    if (problem) return onInvalid(problem)
    if ((nameChanged || initialsChanged) && mentioned) setConfirming(true)
    else void save()
  }
  const cancel = (): void => {
    setName(person.name)
    setInitials(person.initials)
    setMe(person.me)
    onDone()
  }

  if (!editing) {
    return (
      <tr className={styles.row}>
        <td>
          {person.name}
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
          onChange={(event) => setName(event.target.value)}
          onKeyDown={submitOrCancel(submit, cancel)}
        />
        <label className={styles.meLabel}>
          <input type="checkbox" checked={me} onChange={(event) => setMe(event.target.checked)} />
          This is me
        </label>
      </td>
      <td>
        <input
          className={`${styles.input} ${styles.initials}`}
          value={initials}
          maxLength={6}
          aria-label={`Initials of ${person.name}`}
          onChange={(event) => setInitials(event.target.value)}
          onKeyDown={submitOrCancel(submit, cancel)}
        />
      </td>
      <td className={styles.count}>{usage?.meetings ?? 0}</td>
      <td className={styles.count}>{usage?.trainings ?? 0}</td>
      <td className={styles.actions}>
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
            {changeText(nameChanged, initialsChanged)}
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
  const submit = async (): Promise<void> => {
    if (name.trim() === '') return
    if ((await onAdd(name, initials)) === null) onDone()
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
          onChange={(event) => setName(event.target.value)}
          onKeyDown={keys}
        />
      </td>
      <td>
        <input
          className={`${styles.input} ${styles.initials}`}
          value={initials}
          maxLength={6}
          placeholder="Auto"
          aria-label="Initials of the new person"
          onChange={(event) => setInitials(event.target.value)}
          onKeyDown={keys}
        />
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
  onInvalid: (message: string) => void
  onRemove?: (person: Person) => void
  /** Makes this the table of archived people: each row offers Restore instead of Edit and Remove. */
  onRestore?: (person: Person) => void
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
  onInvalid,
  onRemove,
  onRestore
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
              onInvalid={onInvalid}
              onRemove={onRemove && !person.me ? () => onRemove(person) : undefined}
              onRestore={onRestore ? () => onRestore(person) : undefined}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
