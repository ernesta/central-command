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
  /** What the field is called ("group" for notes, "list" for tasks); lower case, used in labels. */
  noun?: string
  /** Whether "No group" can be chosen (a task always has a list). */
  allowNone?: boolean
  /**
   * Whether the form can make a new top-level group (default). When not (Work's lists are its clients), the form makes a
   * sublist and must say what it sits inside.
   */
  allowNewTop?: boolean
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
  onChange,
  noun = 'group',
  allowNone = true,
  allowNewTop = true
}: GroupFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [name, setName] = useState('')
  const [inside, setInside] = useState('')
  const [error, setError] = useState<string | null>(null)
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1)
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

  // Without new top-level groups the form's "Inside" starts at this group, else the first there is.
  const target =
    inside ||
    (allowNewTop ? '' : groups.some((g) => g.name === group) ? group : (groups[0]?.name ?? ''))

  const addNew = (): void => {
    if (!isValidName(name)) {
      setError('A name cannot be empty or contain / or ›.')
      return
    }
    choose(
      target
        ? { group: target, subgroup: cleanName(name) }
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
        aria-label={`${Noun}: ${current || 'none'}`}
        onClick={() => {
          if (open) return close()
          setOpen(true)
          setTimeout(() => filterRef.current?.focus(), 0)
        }}
      >
        <span className={styles.triggerLabel} title={current || undefined}>
          {current || `No ${noun}`}
        </span>
        <ChevronDown size={12} strokeWidth={2} aria-hidden />
      </button>
      {open && (
        <div
          className={styles.popover}
          role="dialog"
          aria-label={`Choose a ${noun}`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              // Only the menu closes: a native <dialog> around it would close on Escape too unless this is prevented.
              event.preventDefault()
              event.stopPropagation()
              close()
            }
          }}
        >
          <input
            ref={filterRef}
            className={styles.input}
            aria-label={`Find a ${noun}`}
            placeholder={`Type to find a ${noun}`}
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
          <ul className={styles.list} aria-label={`${Noun}s`}>
            {allowNone && terms.length === 0 && (
              <li>
                <button
                  type="button"
                  className={styles.item}
                  onClick={() => choose({ group: '', subgroup: '' })}
                >
                  No {noun}
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
              <li className={styles.empty}>No {noun} matches.</li>
            )}
          </ul>
          {(allowNewTop || groups.length > 0) && (
            // Not a <form>: this field sits inside other forms (the Add bar, New task), and a form inside a form never submits.
            <div className={styles.new} role="group">
              <label className={styles.newLabel} htmlFor="new-group">
                New {allowNewTop ? noun : `sub${noun}`}
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
                  onKeyDown={(event) => {
                    // Enter adds the name here and must not reach the form around the field (it would add a task).
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    event.stopPropagation()
                    if (name.trim() !== '') addNew()
                  }}
                />
                <Select
                  label="Inside"
                  value={target}
                  options={[
                    ...(allowNewTop ? [{ value: '', label: 'Inside nothing' }] : []),
                    ...groups.map((g) => ({ value: g.name, label: `Inside ${g.name}` }))
                  ]}
                  onChange={setInside}
                />
                <button
                  type="button"
                  className={styles.submit}
                  disabled={name.trim() === ''}
                  onClick={addNew}
                >
                  Add
                </button>
              </div>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
