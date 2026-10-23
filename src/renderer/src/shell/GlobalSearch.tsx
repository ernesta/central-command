import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { SearchHit } from '@shared/search'
import { ghostFor } from '@shared/search-complete'
import { splitChips } from '@shared/search-chips'
import { fold } from '@shared/text'
import { IconButton } from '../components/IconButton'
import { ChipInput } from './ChipInput'
import { ModifierChip } from './ModifierChip'
import { CompletionList } from './CompletionList'
import { countResults, searchEverywhere, type SearchOutcome } from './run-search'
import { MODIFIER_NAMES, parseSearch } from '@shared/search-query'
import { runNewKind } from './new-kind'
import { useQuickActionWorkspace } from './useQuickActionWorkspace'
import { useSearchSources } from './search-sources'
import { SearchHelp } from './SearchHelp'
import { SearchNotices } from './SearchNotices'
import { useChipQuery } from './useChipQuery'
import { useSearchCompletion, useUserValues } from './useSearchCompletion'
import styles from './GlobalSearch.module.css'

const DELAY_MS = 120
/** Hits per kind in the window, and in the grown window ("See all results"). */
const WINDOW_LIMIT = 6
const EXPANDED_LIMIT = 40

/**
 * Find anything in the app from one field: notes, meetings, training, readings and people, a few of the best
 * matches each, plus a few commands (a command palette sharing the same window). `in:meetings` (or any of the
 * other sources, singular or plural) restricts to it. Render this only while it is open. Arrow keys move
 * between results, Enter opens or runs one, Escape closes. "See all results" grows the same window (wider, taller, up
 * to 40 a kind, with a count) rather than opening a page; closing it leaves the user where they were.
 */
export function GlobalSearch({
  onClose,
  initialQuery = '',
  initialExpanded = false
}: {
  onClose: () => void
  initialQuery?: string
  initialExpanded?: boolean
}): React.JSX.Element {
  const navigate = useNavigate()
  const pageWorkspace = useQuickActionWorkspace()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [expanded, setExpanded] = useState(initialExpanded)
  const [result, setResult] = useState<{ query: string; expanded: boolean } & SearchOutcome>({
    query: '',
    expanded: false,
    groups: [],
    notices: [],
    searched: false,
    impossible: false
  })
  const [active, setActive] = useState(0)

  const sources = useSearchSources()
  const values = useUserValues()
  const person = (folded: string): boolean =>
    (values.with ?? []).some((o) => fold(o.label) === folded || fold(o.hint ?? '') === folded)
  const chip = useChipQuery(person, initialQuery)
  const query = chip.query
  const choices = useSearchCompletion(chip.text, chip.setText, inputRef, values)
  const ghost = ghostFor(chip.text, choices.caret, choices.completion)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    // Closing puts the user back where they were: on the field they had focused, not on nothing.
    const before = document.activeElement
    return () => {
      if (before instanceof HTMLElement && before.isConnected) before.focus()
    }
  }, [])

  // Search a moment after typing stops; an answer for words that have since changed is dropped.
  useEffect(() => {
    if (query.trim() === '') return
    let cancelled = false
    const timer = setTimeout(() => {
      void searchEverywhere(sources, query, expanded ? EXPANDED_LIMIT : undefined).then(
        (outcome) => {
          if (cancelled) return
          setResult({ query, expanded, ...outcome })
          setActive(0)
        }
      )
    }, DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, sources, expanded])

  const searched = query.trim() !== ''
  const groups = useMemo(() => (searched ? result.groups : []), [searched, result.groups])
  // Where each group's first hit sits in the one list the arrow keys walk through.
  const starts = useMemo(
    () => groups.map((_, i) => groups.slice(0, i).reduce((n, g) => n + g.hits.length, 0)),
    [groups]
  )
  const hits = useMemo(
    () => groups.flatMap((g) => g.hits.map((hit) => ({ group: g.id, hit }))),
    [groups]
  )
  const answered = searched && result.query === query && result.expanded === expanded
  const activeIndex = Math.min(active, Math.max(hits.length - 1, 0))
  const capped = groups.some((g) => g.hits.length >= WINDOW_LIMIT)
  const count = countResults(groups, EXPANDED_LIMIT)

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, hits])

  const open = (hit: SearchHit): void => {
    onClose()
    if (hit.run) void hit.run()
    else if (hit.route) void navigate(hit.route)
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (choices.onKeyDown(event)) return
    if (event.key === 'Tab' && !event.shiftKey) {
      // Nothing to complete: Tab finishes a modifier typed in full (`in:meetings`) into a chip.
      const split = splitChips(chip.text, { complete: true, person })
      if (split.chips.length > 0) {
        event.preventDefault()
        chip.setText(chip.text, { complete: true })
      }
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (hits.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((activeIndex + step + hits.length) % hits.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      // A `new:<kind>` makes the empty thing and opens it; it never searches.
      const create = parseSearch(query)
      if (create.create) {
        onClose()
        void runNewKind(create, navigate, pageWorkspace)
        return
      }
      const chosen = hits[activeIndex]
      if (chosen) open(chosen.hit)
    }
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className={[styles.dialog, expanded && styles.expanded].filter(Boolean).join(' ')}
      aria-label="Search"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // A click on the backdrop (the dialog element itself) closes it.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <ChipInput
        chips={chip.chips}
        text={chip.text}
        ghost={ghost}
        caret={chip.caret}
        inputRef={inputRef}
        placeholder="Search, or type a command"
        onText={chip.setText}
        onRemove={chip.remove}
        onKeyDown={onKeyDown}
        onCaret={choices.track}
        inputProps={{
          'aria-label': 'Search',
          role: 'combobox',
          'aria-expanded': hits.length > 0,
          'aria-controls': choices.completion ? 'global-search-filters' : 'global-search-results',
          'aria-activedescendant': choices.completion
            ? choices.active >= 0
              ? `global-search-filters-${choices.active}`
              : undefined
            : hits.length > 0
              ? `global-search-${activeIndex}`
              : undefined
        }}
      />
      {expanded && (
        <div className={styles.bar}>
          <span className={styles.count} role="status">
            {answered && result.searched ? count : ''}
          </span>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} strokeWidth={1.75} aria-hidden />
          </IconButton>
        </div>
      )}
      {choices.typing && (
        <SearchHelp
          modifier={choices.typing.modifier}
          values={choices.values}
          onFill={choices.fill}
        />
      )}
      {answered && <SearchNotices notices={choices.completion ? [] : result.notices} />}
      {choices.completion && (
        <CompletionList
          id="global-search-filters"
          completion={choices.completion}
          active={choices.active}
          onPick={choices.accept}
        />
      )}
      <div className={styles.results} id="global-search-results" role="listbox" ref={listRef}>
        {expanded && !searched && !choices.typing && (
          <div className={styles.filters}>
            <h2 className={styles.heading}>Filters</h2>
            <p className={styles.chips}>
              {MODIFIER_NAMES.map((name) => (
                <ModifierChip
                  key={name}
                  label={`${name}:`}
                  onClick={() => {
                    chip.setText(`${chip.text}${name}:`)
                    inputRef.current?.focus()
                  }}
                />
              ))}
            </p>
          </div>
        )}
        {groups.map((group, groupIndex) => (
          <div key={group.label} role="group" aria-label={group.label}>
            <h2 className={styles.heading}>
              {group.label}
              {expanded && (
                <span className={styles.groupCount}>
                  {group.hits.length >= EXPANDED_LIMIT ? `${EXPANDED_LIMIT}+` : group.hits.length}
                </span>
              )}
            </h2>
            {group.hits.map((hit, hitIndex) => {
              const i = starts[groupIndex] + hitIndex
              return (
                <button
                  key={hit.key}
                  type="button"
                  tabIndex={-1}
                  role="option"
                  id={`global-search-${i}`}
                  data-index={i}
                  aria-selected={i === activeIndex}
                  className={[styles.hit, i === activeIndex && styles.active]
                    .filter(Boolean)
                    .join(' ')}
                  onMouseMove={() => setActive(i)}
                  onClick={() => open(hit)}
                >
                  <span className={styles.title}>{hit.title}</span>
                  {hit.detail && <span className={styles.detail}>{hit.detail}</span>}
                </button>
              )
            })}
          </div>
        ))}
        {answered && result.searched && hits.length === 0 && (
          <p className={styles.empty}>No results.</p>
        )}
        {answered && capped && !expanded && (
          <button
            type="button"
            className={styles.seeAll}
            // The field keeps focus, so typing goes on where it was.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setExpanded(true)
              inputRef.current?.focus()
            }}
          >
            See all results
          </button>
        )}
      </div>
    </dialog>,
    document.body
  )
}
