import { Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { moduleSearches } from '@modules/index'
import type { SearchHit } from '@shared/search'
import { runSearches, type SearchGroup } from './run-search'
import styles from './GlobalSearch.module.css'

const DELAY_MS = 120

/**
 * Find anything in the app from one field: notes, meetings, training and readings, a few of the best matches each.
 * Render it only while it is open. Arrow keys move between results, Enter opens one, Escape closes.
 */
export function GlobalSearch({ onClose }: { onClose: () => void }): React.JSX.Element {
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<{ query: string; groups: SearchGroup[] }>({
    query: '',
    groups: []
  })
  const [active, setActive] = useState(0)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  // Search a moment after typing stops; an answer for words that have since changed is dropped.
  useEffect(() => {
    if (query.trim() === '') return
    let cancelled = false
    const timer = setTimeout(() => {
      void runSearches(moduleSearches(), query).then((groups) => {
        if (cancelled) return
        setResult({ query, groups })
        setActive(0)
      })
    }, DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

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
  const answered = searched && result.query === query
  const activeIndex = Math.min(active, Math.max(hits.length - 1, 0))

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, hits])

  const open = (hit: SearchHit): void => {
    onClose()
    void navigate(hit.route)
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (hits.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((activeIndex + step + hits.length) % hits.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const chosen = hits[activeIndex]
      if (chosen) open(chosen.hit)
    }
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className={styles.dialog}
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
      <div className={styles.field}>
        <Search size={16} strokeWidth={1.75} className={styles.icon} aria-hidden />
        <input
          className={styles.input}
          type="search"
          autoFocus
          placeholder="Search"
          aria-label="Search"
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls="global-search-results"
          aria-activedescendant={hits.length > 0 ? `global-search-${activeIndex}` : undefined}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      <div className={styles.results} id="global-search-results" role="listbox" ref={listRef}>
        {groups.map((group, groupIndex) => (
          <div key={group.id} role="group" aria-label={group.label}>
            <h2 className={styles.heading}>{group.label}</h2>
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
                  <span className={styles.detail}>{hit.detail}</span>
                </button>
              )
            })}
          </div>
        ))}
        {answered && hits.length === 0 && <p className={styles.empty}>No results.</p>}
      </div>
    </dialog>,
    document.body
  )
}
