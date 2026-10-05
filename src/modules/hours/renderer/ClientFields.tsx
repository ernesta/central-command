import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@renderer/components/Button'
import { Input } from '@renderer/components/Input'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { addClient, MAX_CLIENT_LENGTH, removeClient } from '../shared/plan-settings'
import type { HoursWorkspace } from '../shared/workspaces'
import styles from './ClientFields.module.css'

/**
 * Work's clients: who time is for, shown as chips with a field to add another. They are part of the current contract's
 * plan (the next contract starts from them); older entries keep the name they were saved with.
 */
export function ClientFields({
  workspace
}: {
  workspace: HoursWorkspace
}): React.JSX.Element | null {
  const { data } = useTrackingYear(workspace)
  const [text, setText] = useState('')
  if (!data) return null
  const clients = data.plan.clients ?? []
  const save = (next: string[] | null): void => {
    if (next) void window.api.tracking.setPlan(workspace, data.start, { clients: next })
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
            <span>{name}</span>
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
          onChange={(event) => setText(event.target.value)}
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
    </div>
  )
}
