import { Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { PickerPopup } from '@renderer/components/Picker'
import styles from '@renderer/components/SkillsField.module.css'
import { addClient, MAX_CLIENTS } from '../shared/plan-settings'

/**
 * A contract's clients as chips with the shared picker, under "add", to choose from the clients the workspace's other
 * contracts already have; a name that is not there yet is added from the same list.
 */
export function ClientsField({
  clients,
  known,
  label,
  invalid,
  onChange
}: {
  clients: readonly string[]
  /** Every client of the workspace's contracts: what the list offers. */
  known: readonly string[]
  label: string
  invalid?: boolean
  onChange: (clients: string[]) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const addRef = useRef<HTMLButtonElement>(null)
  const full = clients.length >= MAX_CLIENTS
  const taken = new Set(clients.map((name) => name.toLowerCase()))
  const options = [...new Set(known)]
    .filter((name) => !taken.has(name.toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ value: name, label: name }))

  return (
    <div className={styles.wrap}>
      <ul
        className={styles.chips}
        aria-label={label}
        aria-invalid={invalid || undefined}
        style={{ padding: 0 }}
      >
        {clients.map((name) => (
          <li key={name} className={styles.chip}>
            <span>{name}</span>
            <button
              type="button"
              className={styles.remove}
              aria-label={`Remove ${name}`}
              onClick={() => onChange(clients.filter((c) => c !== name))}
            >
              <X size={12} strokeWidth={2} aria-hidden />
            </button>
          </li>
        ))}
        <li>
          <button
            ref={addRef}
            type="button"
            className={styles.add}
            aria-haspopup="listbox"
            aria-expanded={open}
            disabled={full}
            onClick={() => setOpen((o) => !o)}
          >
            <Plus size={12} strokeWidth={2} aria-hidden />
            add
          </button>
        </li>
      </ul>
      {open && !full && (
        <PickerPopup
          anchorRef={addRef}
          minWidth={240}
          options={options}
          label="Add a client"
          noun="clients"
          alwaysSearch
          add={{
            canAdd: (text) => addClient(clients, text) !== null,
            onAdd: (text) => {
              const next = addClient(clients, text)
              if (next) onChange(next)
            }
          }}
          onPick={(name) => onChange([...clients, name])}
          onClose={(reason) => {
            setOpen(false)
            if (reason !== 'outside') addRef.current?.focus()
          }}
        />
      )}
    </div>
  )
}
