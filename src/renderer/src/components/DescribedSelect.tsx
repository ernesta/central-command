import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { SelectOption } from './Select'
import styles from './DescribedSelect.module.css'

export interface DescribedOption<T extends string> extends SelectOption<T> {
  /** A quiet line under the label in the open list. */
  description?: string
}

interface DescribedSelectProps<T extends string> {
  value: T
  options: readonly DescribedOption<T>[]
  onChange: (value: T) => void
  /** Required: selects usually have no visible label of their own. */
  label: string
  id?: string
}

/**
 * A select whose open list explains each option under its name. It is a listbox rather than a native
 * `<select>`, which cannot show a second line; closed, it looks and takes up space like `Select`.
 */
export function DescribedSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  id
}: DescribedSelectProps<T>): React.JSX.Element {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Listed the way the native select lists them: ungrouped first, then each group in turn.
  const groups = [...new Set(options.flatMap((o) => (o.group ? [o.group] : [])))]
  const ordered = [
    ...options.filter((o) => !o.group),
    ...groups.flatMap((g) => options.filter((o) => o.group === g))
  ]
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    listRef.current?.focus()
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
    setActive(
      Math.max(
        0,
        ordered.findIndex((o) => o.value === value)
      )
    )
    setOpen(true)
  }
  const close = (): void => {
    setOpen(false)
    buttonRef.current?.focus()
  }
  const choose = (index: number): void => {
    onChange(ordered[index].value)
    close()
  }

  const listKeys = (event: React.KeyboardEvent): void => {
    const last = ordered.length - 1
    const move = (to: number): void => {
      event.preventDefault()
      setActive(Math.min(last, Math.max(0, to)))
    }
    if (event.key === 'ArrowDown') move(active + 1)
    else if (event.key === 'ArrowUp') move(active - 1)
    else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(last)
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(active)
    } else if (event.key === 'Escape') {
      // Only this list closes, not whatever page or dialog is behind it.
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'Tab') setOpen(false)
  }

  let lastGroup: string | undefined
  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        className={styles.button}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault()
            show()
          }
        }}
      >
        <span className={styles.value}>{selected?.label ?? ''}</span>
        <ChevronDown className={styles.chevron} size={12} strokeWidth={2} aria-hidden />
      </button>
      {open && (
        <div
          ref={listRef}
          id={listId}
          className={styles.list}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={listKeys}
        >
          {ordered.map((option, index) => {
            const heading = option.group !== lastGroup ? option.group : undefined
            lastGroup = option.group
            return (
              <div key={option.value} role="presentation">
                {heading && <div className={styles.group}>{heading}</div>}
                <div
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  data-active={index === active}
                  className={styles.option}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(index)}
                >
                  <span>{option.label}</span>
                  {option.description && (
                    <span className={styles.description}>{option.description}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
