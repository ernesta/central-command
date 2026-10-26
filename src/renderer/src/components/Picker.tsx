import { ChevronDown, Plus } from 'lucide-react'
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import {
  defaultActive,
  hasExactMatch,
  hasSearch,
  highlightRanges,
  matchOptions,
  orderOptions,
  typeAhead,
  type PickerOption
} from './picker-match'
import { PickerInput } from './picker-input'
import styles from './Picker.module.css'
import { Tooltip } from './Tooltip'

export type { PickerOption } from './picker-match'

/** Why a list closed: the parent puts focus back on its control unless the click went elsewhere. */
export type PickerCloseReason = 'pick' | 'escape' | 'tab' | 'outside'

/** A value that is not in the list yet: the list ends with a row that adds it. */
export interface PickerAdd {
  /** The row's words; `Add “…”` unless a field has its own ("Create “…”"). */
  label?: (text: string) => string
  /** Make the value. It may reject with a message, which the list shows; the list closes when it resolves. */
  onAdd: (text: string) => void | Promise<void>
  /** Whether this text can be added at all (besides not being an option already). */
  canAdd?: (text: string) => boolean
  /** Shown under the row while it is offered (the group field's "Inside" choice). */
  extra?: React.ReactNode
}

interface PickerPopupProps<T extends string> {
  /** What the list is placed against and what gets focus back. */
  anchorRef: React.RefObject<HTMLElement | null>
  options: readonly PickerOption<T>[]
  /** The current value: shown as selected, and where the highlight starts. */
  selected?: T | null
  onPick: (value: T) => void
  onClose: (reason: PickerCloseReason) => void
  /** Required: names the list for screen readers. */
  label: string
  /** The plural noun the search placeholder uses: "types" gives "Search types". */
  noun?: string
  /** The search field is always there, not only past seven options. */
  alwaysSearch?: boolean
  add?: PickerAdd
  /** Letters already typed (the control was typed on while closed). */
  initialText?: string
  /** The narrowest the list goes (default: as wide as the anchor, at least 120px when there is a search field). */
  minWidth?: number
}

const addLabel = (text: string): string => `Add “${text}”`

/** The matching letters of a label, in bold. */
export function Highlighted({ label, query }: { label: string; query: string }): React.JSX.Element {
  const ranges = highlightRanges(label, query)
  if (ranges.length === 0) return <>{label}</>
  const parts: React.ReactNode[] = []
  let at = 0
  ranges.forEach(([start, end], i) => {
    if (start > at) parts.push(label.slice(at, start))
    parts.push(
      <mark key={i} className={styles.hit}>
        {label.slice(start, end)}
      </mark>
    )
    at = end
  })
  if (at < label.length) parts.push(label.slice(at))
  return <>{parts}</>
}

/**
 * The open list of every picker: a search field on top when there are more than seven options (or always), the options
 * under their group headings, and an optional "Add" row for a value that is not there yet. Keys: Down/Up and Home/End
 * move, Enter picks, Tab picks and moves on, Escape closes only the list; on a list with no field typing jumps to the
 * option starting with the letters. It is placed against its anchor in the window (so a table or dialog cannot cut it
 * off), on the side with room, and closes when anything outside it scrolls.
 */
export function PickerPopup<T extends string>({
  anchorRef,
  options,
  selected = null,
  onPick,
  onClose,
  label,
  noun,
  alwaysSearch = false,
  add,
  initialText = '',
  minWidth
}: PickerPopupProps<T>): React.JSX.Element {
  const listId = useId()
  const popupRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [input] = useState(() => new PickerInput(initialText))
  const busy = useRef(false)

  const searchable = hasSearch(options.length, alwaysSearch)
  const [text, setText] = useState(searchable ? initialText : '')
  const [error, setError] = useState<string | null>(null)

  const ordered = orderOptions(options)
  const matches = searchable ? matchOptions(options, text) : ordered
  const query = searchable ? text : ''
  const addText = text.trim()
  const offers = (typed: string): boolean =>
    add !== undefined &&
    searchable &&
    typed.trim() !== '' &&
    !hasExactMatch(options, typed.trim()) &&
    (add.canAdd?.(typed.trim()) ?? true)
  const addRow = offers(text)
  const rows = matches.length + (addRow ? 1 : 0)

  const startAt = (nextText: string): number =>
    defaultActive(searchable ? matchOptions(options, nextText) : ordered, nextText, {
      selected,
      addRow: offers(nextText)
    })
  const [active, setActive] = useState(() => {
    if (!searchable && initialText) {
      const at = typeAhead(ordered, initialText)
      if (at >= 0) return at
    }
    return startAt(searchable ? initialText : '')
  })
  const current = Math.min(active, rows - 1)

  // Placed once, when it opens: on the side with room, never wider than the window, never cut off.
  useLayoutEffect(() => {
    const popup = popupRef.current
    const anchor = anchorRef.current
    if (!popup || !anchor) return
    const rect = anchor.getBoundingClientRect()
    const margin = 8
    popup.style.minWidth = `${minWidth ?? Math.max(rect.width, searchable ? 120 : 0)}px`
    const width = popup.offsetWidth
    // Kept as it opens, so the list does not narrow and widen as the search takes options away.
    popup.style.width = `${width}px`
    const natural = popup.offsetHeight
    const below = window.innerHeight - rect.bottom - margin - 4
    const above = rect.top - margin - 4
    const downwards = natural <= below || below >= above
    const room = Math.max(120, downwards ? below : above)
    popup.style.maxHeight = `${Math.min(room, window.innerHeight * 0.6)}px`
    if (downwards) popup.style.top = `${rect.bottom + 4}px`
    else popup.style.bottom = `${window.innerHeight - rect.top + 4}px`
    const left = rect.left + width > window.innerWidth - margin ? rect.right - width : rect.left
    popup.style.left = `${Math.max(margin, left)}px`
  }, [anchorRef, minWidth, searchable])

  useEffect(() => {
    const target = searchable ? inputRef.current : listRef.current
    target?.focus({ preventScroll: true })
    if (searchable && inputRef.current) {
      const end = inputRef.current.value.length
      inputRef.current.setSelectionRange(end, end)
    }
  }, [searchable])

  // The latest close, so the listeners below are set up once.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    const away = (event: MouseEvent): void => {
      const target = event.target as Node
      if (popupRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      closeRef.current('outside')
    }
    // A list left in place by a scroll or a resize would point at nothing.
    const moveAway = (event: Event): void => {
      if (event.target instanceof Node && popupRef.current?.contains(event.target)) return
      closeRef.current('outside')
    }
    document.addEventListener('mousedown', away)
    window.addEventListener('scroll', moveAway, true)
    window.addEventListener('resize', moveAway)
    return () => {
      document.removeEventListener('mousedown', away)
      window.removeEventListener('scroll', moveAway, true)
      window.removeEventListener('resize', moveAway)
    }
  }, [anchorRef])

  useEffect(() => {
    popupRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [current])

  const doAdd = async (): Promise<void> => {
    if (!add || busy.current) return
    busy.current = true
    try {
      await add.onAdd(addText)
      onClose('pick')
    } catch (e) {
      setError(ipcErrorMessage(e))
    } finally {
      busy.current = false
    }
  }
  const pick = (index: number): void => {
    if (index >= 0 && index < matches.length) {
      onPick(matches[index].value)
      onClose('pick')
    } else if (index === matches.length && addRow) void doAdd()
  }

  const type = (next: string): void => {
    setText(next)
    setError(null)
    setActive(startAt(next))
  }

  const highlight = (index: number) => (event: React.MouseEvent) => {
    // Only a real pointer move highlights: a list that scrolls under a still pointer must not.
    if (input.pointerMoved(event.clientX, event.clientY)) setActive(index)
  }

  const keys = (event: React.KeyboardEvent): void => {
    // A list inside this one (the group field's "Inside") handles its own keys.
    if ((event.target as HTMLElement).closest('[data-picker-popup]') !== popupRef.current) return
    const handled = (): void => {
      event.preventDefault()
      event.stopPropagation()
    }
    const go = (to: number): void => {
      handled()
      input.markMoved()
      setActive(Math.min(rows - 1, Math.max(0, to)))
    }
    const last = rows - 1
    switch (event.key) {
      case 'ArrowDown':
        return go(current + 1)
      case 'ArrowUp':
        return go(current < 0 ? last : current - 1)
      case 'Home':
      case 'End':
        // In the search field they move the caret, unless there is nothing to move it through.
        if (searchable && text !== '') return
        return go(event.key === 'Home' ? 0 : last)
      case 'Enter':
        handled()
        return pick(current)
      case 'Escape':
        handled()
        return onClose('escape')
      case 'Tab':
        // Tab takes the highlighted row, if the arrows or the typing led to it, and moves on; Shift+Tab takes nothing.
        if (!event.shiftKey && current >= 0 && (input.moved || text.trim() !== '')) pick(current)
        else onClose('tab')
        return
    }
    if (searchable || event.metaKey || event.ctrlKey || event.altKey) return
    if (event.key === ' ' && !input.typing) {
      handled()
      return pick(current)
    }
    if (event.key.length === 1) {
      // No search field: the letters jump to the first option starting with them.
      handled()
      const at = typeAhead(ordered, input.letter(event.key))
      if (at >= 0) {
        input.markMoved()
        setActive(at)
      }
    }
  }

  const placeholder = noun ? `Search ${noun}` : 'Search'
  return (
    <div
      ref={popupRef}
      className={styles.popup}
      data-picker-popup=""
      role="presentation"
      onKeyDown={keys}
    >
      {searchable && (
        <input
          ref={inputRef}
          className={styles.search}
          role="combobox"
          aria-label={placeholder}
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={current >= 0 ? `${listId}-${current}` : undefined}
          aria-autocomplete="list"
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          value={text}
          onChange={(event) => type(event.target.value.replace(/[\r\n]/g, ''))}
        />
      )}
      <div
        ref={listRef}
        id={listId}
        className={styles.list}
        role="listbox"
        aria-label={label}
        tabIndex={searchable ? undefined : -1}
        aria-activedescendant={!searchable && current >= 0 ? `${listId}-${current}` : undefined}
      >
        {matches.map((option, index) => {
          const heading =
            index === 0 || matches[index - 1].group !== option.group ? option.group : undefined
          return (
            <Fragment key={option.value}>
              {heading && (
                <div className={styles.group} role="presentation">
                  {heading}
                </div>
              )}
              <div
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === selected}
                data-active={index === current}
                className={[styles.option, option.nested && styles.nested]
                  .filter(Boolean)
                  .join(' ')}
                onMouseMove={highlight(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(index)}
              >
                <Tooltip text={option.label} whenCut>
                  <span className={styles.cut}>
                    <Highlighted label={option.label} query={query} />
                  </span>
                </Tooltip>
                {option.description && (
                  <Tooltip text={option.description} whenCut>
                    <span className={[styles.description, styles.cut].join(' ')}>
                      <Highlighted label={option.description} query={query} />
                    </span>
                  </Tooltip>
                )}
              </div>
            </Fragment>
          )
        })}
        {matches.length === 0 && !addRow && (
          <p className={styles.none}>{options.length === 0 ? 'Nothing to choose' : 'No match'}</p>
        )}
        {addRow && add && (
          <div className={matches.length > 0 ? styles.divided : undefined}>
            <div
              id={`${listId}-${matches.length}`}
              role="option"
              aria-selected={false}
              data-active={matches.length === current}
              className={[styles.option, styles.add].join(' ')}
              onMouseMove={highlight(matches.length)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(matches.length)}
            >
              <Plus size={14} strokeWidth={1.75} aria-hidden />
              <Tooltip text={(add.label ?? addLabel)(addText)} whenCut>
                <span className={styles.addText}>{(add.label ?? addLabel)(addText)}</span>
              </Tooltip>
            </div>
            {add.extra && <div className={styles.extra}>{add.extra}</div>}
          </div>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

export interface PickerProps<T extends string> {
  value: T
  options: readonly PickerOption<T>[]
  onChange: (value: T) => void
  /** Required: pickers usually have no visible label of their own. */
  label: string
  id?: string
  /** The plural noun for the search placeholder ("types" gives "Search types"). */
  noun?: string
  /** Search whatever the number of options. */
  alwaysSearch?: boolean
  /** A value that is not in the list can be added. The field always searches then. */
  add?: PickerAdd
  /** Shown closed when the value is not one of the options (or there is none), instead of the option's label. */
  text?: string
  /** Shown in muted type while nothing is chosen. */
  placeholder?: string
  /** The height of a toolbar or filter row. */
  compact?: boolean
  /** A table cell: plain text until hovered or focused. */
  plain?: boolean
  className?: string
  disabled?: boolean
  title?: string
  /** The narrowest the open list goes, when the control is small and the options are long. */
  listMinWidth?: number
  /** The list opened or closed (a field that keeps a draft while it is open clears it on close). */
  onOpenChange?: (open: boolean) => void
}

/**
 * The one way to choose from a list. Closed it is a value and a chevron; opened it is a `PickerPopup` under it. Typing
 * on the focused control opens the list with those letters in.
 */
export function Picker<T extends string>({
  value,
  options,
  onChange,
  label,
  id,
  noun,
  alwaysSearch,
  add,
  text,
  placeholder,
  compact,
  plain,
  className,
  disabled,
  title,
  listMinWidth,
  onOpenChange
}: PickerProps<T>): React.JSX.Element {
  const listId = useId()
  const [open, setOpenState] = useState(false)
  const [typed, setTyped] = useState('')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const selected = options.find((o) => o.value === value)
  const shown = text ?? selected?.label ?? ''

  const setOpen = (next: boolean): void => {
    setOpenState(next)
    onOpenChange?.(next)
  }
  const close = (reason: PickerCloseReason): void => {
    setOpen(false)
    setTyped('')
    if (reason !== 'outside') buttonRef.current?.focus()
  }
  // The widest label, unseen, sets the control's width (a long list is left out of that).
  const sizer = options.length <= 60 ? [...options.map((o) => o.label), shown] : [shown]

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <Tooltip text={title}>
        <button
          ref={buttonRef}
          id={id}
          type="button"
          disabled={disabled}
          className={[styles.button, compact && styles.compact, plain && styles.plain]
            .filter(Boolean)
            .join(' ')}
          aria-label={label}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={() => setOpen(!open)}
          onKeyDown={(event) => {
            if (open) return
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              setOpen(true)
            } else if (
              event.key.length === 1 &&
              event.key !== ' ' &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.altKey
            ) {
              // Typing on the closed control opens it with those letters already entered.
              event.preventDefault()
              setTyped(event.key)
              setOpen(true)
            }
          }}
        >
          <span className={styles.cell}>
            <span
              className={[styles.value, !shown && styles.placeholder].filter(Boolean).join(' ')}
            >
              {shown || placeholder || ''}
            </span>
            {!plain && (
              <span className={styles.sizer} aria-hidden>
                {sizer.map((s, i) => (
                  <span key={i}>{s}</span>
                ))}
              </span>
            )}
          </span>
          <ChevronDown className={styles.chevron} size={12} strokeWidth={2} aria-hidden />
        </button>
      </Tooltip>
      {open && (
        <PickerPopup
          anchorRef={buttonRef}
          options={options}
          selected={value}
          onPick={onChange}
          onClose={close}
          label={label}
          noun={noun}
          alwaysSearch={alwaysSearch || add !== undefined}
          add={add}
          initialText={typed}
          minWidth={listMinWidth}
        />
      )}
    </div>
  )
}
