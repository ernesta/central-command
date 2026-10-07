import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@renderer/components/Button'
import { FieldError } from '@renderer/components/FieldError'
import { Input } from '@renderer/components/Input'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { clientRefusal, cleanClientName } from '@shared/tracking/client-names'
import { addClient, MAX_CLIENT_LENGTH, removeClient } from '../shared/plan-settings'
import type { HoursWorkspace } from '../shared/workspaces'
import styles from './ClientFields.module.css'

/**
 * Work's clients: who time is for, shown as chips with a field to add another. They are part of the current contract's
 * plan (the next contract starts from them). A client is also Work's Tasks list of that name: renaming one renames the
 * list, its tasks and its hours; removing one whose list still holds tasks is refused (the store says so).
 */
export function ClientFields({
  workspace
}: {
  workspace: HoursWorkspace
}): React.JSX.Element | null {
  const { data } = useTrackingYear(workspace)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<{ name: string; text: string } | null>(null)
  const [refused, setRefused] = useState<string | null>(null)
  if (!data) return null
  const clients = data.plan.clients ?? []
  const save = (next: string[] | null): void => {
    if (!next) return
    void window.api.tracking.setPlan(workspace, data.start, { clients: next }).then((result) => {
      setRefused(
        result.ok ? null : clientRefusal(result.reason, result.detail?.client, result.detail?.tasks)
      )
    })
  }
  const rename = (): void => {
    if (!editing) return
    const { name } = editing
    const to = cleanClientName(editing.text)
    if (to === null || to === name) {
      setEditing(null)
      setRefused(to === null ? clientRefusal('bad-name') : null)
      return
    }
    void window.api.tracking.renameClient(workspace, name, to).then((result) => {
      if (result.ok) {
        setEditing(null)
        setRefused(null)
      } else setRefused(clientRefusal(result.reason))
    })
  }
  const next = addClient(clients, text)
  const add = (): void => {
    if (!next) return
    save(next)
    setText('')
  }

  return (
    <div className={styles.field}>
      <span className={styles.label} id={`hours-${workspace}-clients`}>
        Clients
      </span>
      <ul className={styles.chips} aria-labelledby={`hours-${workspace}-clients`}>
        {clients.map((name) => (
          <li key={name} className={styles.chip}>
            {editing?.name === name ? (
              <Input
                className={styles.rename}
                aria-label={`Rename ${name}`}
                maxLength={MAX_CLIENT_LENGTH}
                autoFocus
                value={editing.text}
                onChange={(event) => setEditing({ name, text: event.target.value })}
                onBlur={() => setEditing(null)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    rename()
                  } else if (event.key === 'Escape') {
                    event.stopPropagation()
                    setEditing(null)
                    setRefused(null)
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className={styles.name}
                aria-label={`Rename ${name}`}
                onClick={() => {
                  setRefused(null)
                  setEditing({ name, text: name })
                }}
              >
                {name}
              </button>
            )}
            <button
              type="button"
              className={styles.remove}
              aria-label={`Remove ${name}`}
              disabled={removeClient(clients, name) === null}
              onClick={() => save(removeClient(clients, name))}
            >
              <X size={12} strokeWidth={2} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.add}>
        <Input
          aria-label="New client"
          placeholder="New client"
          maxLength={MAX_CLIENT_LENGTH}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setRefused(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            }
          }}
        />
        <Button disabled={!next} onClick={add}>
          Add
        </Button>
      </div>
      {refused && <FieldError message={refused} />}
    </div>
  )
}
