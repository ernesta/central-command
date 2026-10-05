import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import styles from './ComboField.module.css'

interface ComboFieldProps {
  value: string
  /** Values to choose from; anything else can still be typed. */
  options: readonly string[]
  onChange: (value: string) => void
  /** Required: the field usually has its label elsewhere. */
  label: string
  id?: string
  placeholder?: string
  /** The field lost focus. */
  onBlur?: () => void
}

/**
 * A text field with a drop-down of the values already used: pick one, or type a new one. Unlike a native
 * `<datalist>`, the list always shows every option, however much is typed.
 */
export function ComboField({
  value,
  options,
  onChange,
  label,
  id,
  placeholder,
  onBlur
}: ComboFieldProps): React.JSX.Element {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  useEffect(() => {
    if (open)
      listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const show = (): void => {
    setActive(options.indexOf(value))
    setOpen(true)
  }
  const choose = (index: number): void => {
    onChange(options[index])
    setOpen(false)
    inputRef.current?.focus()
  }

  const keys = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) return show()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((a) => Math.min(options.length - 1, Math.max(0, a + step)))
    } else if (event.key === 'Enter' && open && active >= 0) {
      event.preventDefault()
      choose(active)
    } else if (event.key === 'Escape' && open) {
      // Only this list closes, not whatever page or dialog is behind it.
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    } else if (event.key === 'Tab') setOpen(false)
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <input
        ref={inputRef}
        id={id}
        className={styles.input}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-autocomplete="none"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[\r\n]/g, ''))}
        onKeyDown={keys}
        onBlur={onBlur}
      />
      {options.length > 0 && (
        <button
          type="button"
          tabIndex={-1}
          className={styles.toggle}
          aria-label={`Show ${label.toLowerCase()} list`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            inputRef.current?.focus()
            if (open) setOpen(false)
            else show()
          }}
        >
          <ChevronDown size={12} strokeWidth={2} aria-hidden />
        </button>
      )}
      {open && (
        <div ref={listRef} id={listId} className={styles.list} role="listbox" aria-label={label}>
          {options.map((option, index) => (
            <div
              key={option}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option === value}
              data-active={index === active}
              className={styles.option}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
