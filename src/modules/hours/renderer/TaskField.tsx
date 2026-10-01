import { useId, useState } from 'react'
import { suggestLabels } from '../shared/tasks'
import styles from './TaskField.module.css'

interface TaskFieldProps {
  value: string
  onChange: (value: string) => void
  /** Pressed Enter with no suggestion highlighted. */
  onSubmit?: () => void
  /** Earlier task names, offered only while something is typed. */
  labels: readonly string[]
  label: string
  placeholder?: string
  autoFocus?: boolean
}

/** A free-text task name. Earlier names are suggested while typing, never before. */
export function TaskField({
  value,
  onChange,
  onSubmit,
  labels,
  label,
  placeholder,
  autoFocus
}: TaskFieldProps): React.JSX.Element {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const shown = open ? suggestLabels(labels, value) : []
  const list = shown.length > 0

  const pick = (index: number): void => {
    onChange(shown[index])
    setOpen(false)
    setActive(-1)
  }

  const keys = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!list) return
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((a) => Math.min(shown.length - 1, Math.max(0, a + step)))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (list && active >= 0) pick(active)
      else onSubmit?.()
    } else if (event.key === 'Escape' && list) {
      // Only the list closes, not the form behind it.
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div className={styles.root}>
      <input
        className={styles.input}
        role="combobox"
        aria-label={label}
        aria-expanded={list}
        aria-controls={list ? listId : undefined}
        aria-activedescendant={list && active >= 0 ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        placeholder={placeholder}
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => {
          onChange(event.target.value.replace(/[\r\n]/g, ''))
          setOpen(true)
          setActive(-1)
        }}
        onKeyDown={keys}
        onBlur={() => setOpen(false)}
      />
      {list && (
        <div id={listId} className={styles.list} role="listbox" aria-label={label}>
          {shown.map((option, index) => (
            <div
              key={option}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              data-active={index === active}
              className={styles.option}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(index)}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
