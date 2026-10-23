import { Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { activePeople, findByName, sortPeople, type Person } from '@shared/people'
import { PickerPopup, type PickerOption } from './Picker'
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

/** People as initials chips (Meetings attendees, Training leads), with the shared picker to add people. */
export function PeopleField({
  label,
  noun,
  names,
  people,
  onChange,
  onAddPerson
}: PeopleFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const addRef = useRef<HTMLButtonElement>(null)

  const attending = new Set(names.map((a) => a.toLowerCase()))
  // Who can still be added; the search also finds a person by their initials.
  const options: PickerOption[] = sortPeople(
    activePeople(people).filter((p) => !attending.has(p.name.toLowerCase()))
  ).map((p) => ({ value: p.name, label: p.name, keywords: p.initials }))

  return (
    <div className={styles.wrap}>
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
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <Plus size={12} strokeWidth={2} aria-hidden />
            add
          </button>
        </li>
      </ul>
      {open && (
        <PickerPopup
          anchorRef={addRef}
          options={options}
          label={`Add ${noun === 'attendee' ? 'an' : 'a'} ${noun}`}
          noun={label.toLowerCase()}
          onPick={(name) => onChange([...names, name])}
          add={{
            // Nobody in the people list (archived or already added included) has this name.
            canAdd: (name) => !people.some((p) => p.name.toLowerCase() === name.toLowerCase()),
            onAdd: async (name) => {
              const person = await onAddPerson(name)
              onChange([...names, person.name])
            }
          }}
          onClose={(reason) => {
            setOpen(false)
            if (reason !== 'outside') addRef.current?.focus()
          }}
        />
      )}
    </div>
  )
}
