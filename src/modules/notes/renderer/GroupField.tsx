import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Select } from '@renderer/components/Select'
import { fold } from '@shared/text'
import {
  cleanName,
  groupLabel,
  groupOptions,
  isValidName,
  nameKey,
  type GroupSummary
} from '../shared/groups'
import styles from './GroupField.module.css'

interface GroupFieldProps {
  group: string
  subgroup: string
  /** The groups the notes use now. */
  groups: GroupSummary[]
  onChange: (value: { group: string; subgroup: string }) => void
}

/**
 * A note's group: a menu of the groups that exist (two levels, type to narrow it) and a small form to make a
 * new one. A new group is a name and what it sits inside (nothing, or an existing group), so nobody types a
 * separator.
 */
export function GroupField({
  group,
  subgroup,
  groups,
  onChange
}: GroupFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [name, setName] = useState('')
  const [inside, setInside] = useState('')
  const [error, setError] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const filterRef = useRef<HTMLInputElement>(null)

  const reset = (): void => {
    setOpen(false)
    setFilter('')
    setName('')
    setInside('')
    setError(null)
  }
  const close = (): void => {
    reset()
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent): void => {
      if (!wrapRef.current?.contains(event.target as Node)) reset()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const choose = (value: { group: string; subgroup: string }): void => {
    // Only the two names go on: an option carries more than that.
    onChange({ group: value.group, subgroup: value.subgroup })
    close()
  }

  const terms = fold(filter).split(/\s+/).filter(Boolean)
  const options = groupOptions(groups).filter((o) => {
    const text = fold(o.label)
    return terms.every((t) => text.includes(t))
  })
  const current = groupLabel(group, subgroup)
  const isCurrent = (g: string, s: string): boolean =>
    nameKey(g) === nameKey(group) && nameKey(s) === nameKey(subgroup)

  const addNew = (): void => {
    if (!isValidName(name)) {
      setError('A name cannot be empty or contain / or ›.')
      return
    }
    choose(
      inside
        ? { group: inside, subgroup: cleanName(name) }
        : { group: cleanName(name), subgroup: '' }
    )
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={[styles.trigger, !current && styles.none].filter(Boolean).join(' ')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Group: ${current || 'none'}`}
        onClick={() => {
          if (open) return close()
          setOpen(true)
          setTimeout(() => filterRef.current?.focus(), 0)
        }}
      >
        {current || 'No group'}
        <ChevronDown size={12} strokeWidth={2} aria-hidden />
      </button>
      {open && (
        <div
          className={styles.popover}
          role="dialog"
          aria-label="Choose a group"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              close()
            }
          }}
        >
          <input
            ref={filterRef}
            className={styles.input}
            aria-label="Find a group"
            placeholder="Type to find a group"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            onKeyDown={(event) => {
              // Enter picks the only match, so the menu can be used without the mouse.
              if (event.key === 'Enter' && options.length === 1) {
                event.preventDefault()
                choose(options[0])
              }
            }}
          />
          <ul className={styles.list} aria-label="Groups">
            {terms.length === 0 && (
              <li>
                <button
                  type="button"
                  className={styles.item}
                  onClick={() => choose({ group: '', subgroup: '' })}
                >
                  No group
                  {!group && <Check size={14} strokeWidth={2} aria-hidden />}
                </button>
              </li>
            )}
            {options.map((o) => (
              <li key={o.label}>
                <button
                  type="button"
                  className={[styles.item, o.depth === 1 && styles.nested]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => choose(o)}
                >
                  {o.depth === 1 ? o.subgroup : o.group}
                  {isCurrent(o.group, o.subgroup) && (
                    <Check size={14} strokeWidth={2} aria-hidden />
                  )}
                </button>
              </li>
            ))}
            {terms.length > 0 && options.length === 0 && (
              <li className={styles.empty}>No group matches.</li>
            )}
          </ul>
          <form
            className={styles.new}
            onSubmit={(event) => {
              event.preventDefault()
              addNew()
            }}
          >
            <label className={styles.newLabel} htmlFor="new-group">
              New group
            </label>
            <div className={styles.newRow}>
              <input
                id="new-group"
                className={styles.input}
                placeholder="Name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setError(null)
                }}
              />
              <Select
                label="Inside"
                value={inside}
                options={[
                  { value: '', label: 'Inside nothing' },
                  ...groups.map((g) => ({ value: g.name, label: `Inside ${g.name}` }))
                ]}
                onChange={setInside}
              />
              <button type="submit" className={styles.submit} disabled={name.trim() === ''}>
                Add
              </button>
            </div>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
