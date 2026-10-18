import { Check, ChevronDown, Plus } from 'lucide-react'
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
  /** For a table cell: reads as plain text, the box and arrow appear on hover, focus or while open. */
  plain?: boolean
}

/**
 * A note's group: a menu of the groups that exist (two levels). One field: typing narrows the menu, and a name that
 * is not there yet ends it with Create "…" and what it sits inside (nothing, or an existing group), so nobody types a
 * separator.
 */
export function GroupField({
  group,
  subgroup,
  groups,
  onChange,
  noun = 'group',
  allowNone = true,
  allowNewTop = true,
  plain = false
}: GroupFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [inside, setInside] = useState('')
  const [place, setPlace] = useState<React.CSSProperties | undefined>(undefined)
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const filterRef = useRef<HTMLInputElement>(null)

  const reset = (): void => {
    setOpen(false)
    setFilter('')
    setInside('')
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
    // A fixed menu would be left behind by a scroll or resize.
    const onMove = (event: Event): void => {
      if (plain && !wrapRef.current?.contains(event.target as Node)) reset()
    }
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, plain])

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

  const typed = cleanName(filter)
  const exists = (groups.find((g) => g.name === target)?.subgroups ?? groups).some(
    (g) => nameKey(g.name) === nameKey(typed)
  )
  const canCreate = typed !== '' && isValidName(typed) && !exists && (allowNewTop || target !== '')
  const addNew = (): void => {
    choose(target ? { group: target, subgroup: typed } : { group: typed, subgroup: '' })
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={[styles.trigger, plain && styles.plain, !current && styles.none]
          .filter(Boolean)
          .join(' ')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${Noun}: ${current || 'none'}`}
        onClick={() => {
          if (open) return close()
          // In a table the menu is fixed to the window, so the table's scrolling box cannot cut it off.
          const rect = triggerRef.current?.getBoundingClientRect()
          if (plain && rect) {
            const below = window.innerHeight - rect.bottom > 340
            setPlace({
              position: 'fixed',
              right: 'auto',
              left: Math.max(8, rect.right - 320),
              ...(below
                ? { top: rect.bottom + 4 }
                : { top: 'auto', bottom: window.innerHeight - rect.top + 4 })
            })
          }
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
          ref={popRef}
          className={styles.popover}
          style={plain ? place : undefined}
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
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                popRef.current?.querySelector<HTMLElement>('ul button')?.focus()
                return
              }
              // Enter picks the only match, so the menu can be used without the mouse.
              if (event.key !== 'Enter') return
              // Enter must not reach a form around the field (it would add a task).
              event.preventDefault()
              event.stopPropagation()
              if (options.length === 1) choose(options[0])
              else if (canCreate) addNew()
            }}
          />
          <ul
            className={styles.list}
            aria-label={`${Noun}s`}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
              event.preventDefault()
              const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button')]
              const at = items.indexOf(document.activeElement as HTMLElement)
              if (event.key === 'ArrowUp' && at <= 0) filterRef.current?.focus()
              else
                items[
                  Math.min(items.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1))
                ]?.focus()
            }}
          >
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
            {terms.length > 0 && options.length === 0 && !canCreate && (
              <li className={styles.empty}>No {noun} matches.</li>
            )}
          </ul>
          {canCreate && (
            <div className={styles.new} role="group" aria-label={`New ${noun}`}>
              <button
                type="button"
                className={styles.create}
                title={`Create “${typed}”`}
                onClick={addNew}
              >
                <Plus size={14} strokeWidth={1.75} aria-hidden />
                <span className={styles.createTitle}>Create “{typed}”</span>
              </button>
              <Select
                label="Inside"
                value={target}
                options={[
                  ...(allowNewTop ? [{ value: '', label: 'Inside nothing' }] : []),
                  ...groups.map((g) => ({ value: g.name, label: `Inside ${g.name}` }))
                ]}
                onChange={setInside}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
