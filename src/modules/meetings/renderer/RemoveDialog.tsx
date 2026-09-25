import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { Dialog } from '@renderer/components/Dialog'
import { Select } from '@renderer/components/Select'
import { activePeople } from '@shared/people'
import type { RemoveHow } from '../shared/api'
import { mentionedText, mergeSentence } from '../shared/people-copy'
import type { PersonUsage } from '../shared/people-usage'
import type { Person } from '../shared/types'
import styles from './RemoveDialog.module.css'

interface RemoveDialogProps {
  person: Person
  usage: PersonUsage | undefined
  everyone: readonly Person[]
  onCancel: () => void
  onConfirm: (how: RemoveHow) => void
}

/**
 * Removing someone: Delete when no note mentions them; otherwise Archive (the notes stay as they are) or Merge
 * (their name and TODO initials in the notes change to another person's).
 */
export function RemoveDialog({
  person,
  usage,
  everyone,
  onCancel,
  onConfirm
}: RemoveDialogProps): React.JSX.Element {
  const [choice, setChoice] = useState<'archive' | 'merge'>('archive')
  const [merging, setMerging] = useState(false)
  const [into, setInto] = useState('')
  const others = activePeople(everyone).filter((p) => p.name !== person.name)
  const cancel = (
    <Button size="small" autoFocus onClick={onCancel}>
      Cancel
    </Button>
  )

  if (!usage || usage.meetings + usage.trainings === 0) {
    return (
      <Dialog
        title={`Delete ${person.name}?`}
        onCancel={onCancel}
        actions={
          <>
            {cancel}
            <Button size="small" variant="danger" onClick={() => onConfirm({ how: 'delete' })}>
              Delete
            </Button>
          </>
        }
      >
        No meeting or training mentions them.
      </Dialog>
    )
  }

  if (merging) {
    return (
      <Dialog
        title={`Merge ${person.name} into`}
        onCancel={onCancel}
        actions={
          <>
            {cancel}
            <Button
              size="small"
              variant="primary"
              disabled={into === ''}
              onClick={() => onConfirm({ how: 'merge', into })}
            >
              Merge
            </Button>
          </>
        }
      >
        <Select
          label="Merge into"
          className={styles.select}
          value={into}
          options={[
            { value: '', label: 'Choose someone' },
            ...others.map((p) => ({ value: p.name, label: `${p.name} (${p.initials})` }))
          ]}
          onChange={setInto}
        />
        <p className={styles.text}>{mergeSentence(usage)}</p>
      </Dialog>
    )
  }

  return (
    <Dialog
      title={`Remove ${person.name}?`}
      onCancel={onCancel}
      actions={
        <>
          {cancel}
          <Button
            size="small"
            variant="primary"
            onClick={() =>
              choice === 'archive' ? onConfirm({ how: 'archive' }) : setMerging(true)
            }
          >
            {choice === 'archive' ? 'Archive' : 'Merge'}
          </Button>
        </>
      }
    >
      <p className={styles.text}>{mentionedText(usage)}</p>
      <fieldset className={styles.choices}>
        <legend className={styles.legend}>What to do</legend>
        <label className={styles.option}>
          <input
            type="radio"
            name="remove"
            checked={choice === 'archive'}
            onChange={() => setChoice('archive')}
          />
          <span>
            <strong>Archive</strong>
            <span className={styles.hint}>Notes stay as they are.</span>
          </span>
        </label>
        <label className={styles.option}>
          <input
            type="radio"
            name="remove"
            checked={choice === 'merge'}
            disabled={others.length === 0}
            onChange={() => setChoice('merge')}
          />
          <span>
            <strong>Merge</strong>
            <span className={styles.hint}>Replace with another person.</span>
          </span>
        </label>
      </fieldset>
    </Dialog>
  )
}
