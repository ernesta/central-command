import { ArrowDown, ArrowUp, FileText } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ReadingSort, SortKey } from '../shared/query'
import type { Reading } from '../shared/types'
import { StatusPill } from './StatusPill'
import styles from './ReadingsTable.module.css'

const ROW_HEIGHT = 56

interface Column {
  label: string
  /** Absent when the column cannot be sorted. */
  sortKey?: SortKey
}

const COLUMNS: Column[] = [
  { label: 'Citation', sortKey: 'citation' },
  { label: 'Title', sortKey: 'title' },
  { label: 'Year', sortKey: 'year' },
  { label: 'Status', sortKey: 'status' },
  { label: 'Tags' }
]

interface ReadingsTableProps {
  readings: Reading[]
  sort: ReadingSort
  onSortChange: (key: SortKey) => void
  onOpen: (reading: Reading) => void
}

/** Virtualised so ~2,000 rows stay smooth. Arrow keys move, Home/End/PageUp/PageDown jump, Enter opens. */
export function ReadingsTable({
  readings,
  sort,
  onSortChange,
  onOpen
}: ReadingsTableProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const focusAfterRender = useRef(false)

  // TanStack Virtual returns unmemoisable functions; that is fine here because nothing downstream memoises on them.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: readings.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10
  })

  // Keep the active row valid when the list shrinks (filters, search).
  const activeIndex = Math.min(active, Math.max(readings.length - 1, 0))

  useEffect(() => {
    if (!focusAfterRender.current) return
    const row = scrollRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    if (row) {
      focusAfterRender.current = false
      row.focus({ preventScroll: true })
    }
  })

  const move = (next: number): void => {
    const clamped = Math.max(0, Math.min(readings.length - 1, next))
    focusAfterRender.current = true
    setActive(clamped)
    virtualizer.scrollToIndex(clamped, { align: 'auto' })
  }

  const onKeyDown = (event: React.KeyboardEvent, reading: Reading, index: number): void => {
    const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 400) / ROW_HEIGHT) - 1)
    switch (event.key) {
      case 'ArrowDown':
        return (move(index + 1), event.preventDefault())
      case 'ArrowUp':
        return (move(index - 1), event.preventDefault())
      case 'PageDown':
        return (move(index + page), event.preventDefault())
      case 'PageUp':
        return (move(index - page), event.preventDefault())
      case 'Home':
        return (move(0), event.preventDefault())
      case 'End':
        return (move(readings.length - 1), event.preventDefault())
      case 'Enter':
        return (onOpen(reading), event.preventDefault())
    }
  }

  return (
    <div ref={scrollRef} className={styles.scroll}>
      <div
        className={styles.table}
        role="table"
        aria-label="Readings"
        aria-rowcount={readings.length + 1}
      >
        <div className={styles.headerWrap}>
          <div className={`${styles.row} ${styles.header}`} role="row">
            {COLUMNS.map(({ label, sortKey }) => {
              const sorted = sortKey !== undefined && sort.key === sortKey
              return (
                <div
                  key={label}
                  role="columnheader"
                  aria-sort={
                    sorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                >
                  {sortKey ? (
                    <button
                      type="button"
                      className={styles.headerCell}
                      onClick={() => onSortChange(sortKey)}
                    >
                      {label}
                      {sorted &&
                        (sort.direction === 'asc' ? (
                          <ArrowUp size={12} strokeWidth={2} aria-hidden />
                        ) : (
                          <ArrowDown size={12} strokeWidth={2} aria-hidden />
                        ))}
                    </button>
                  ) : (
                    <span className={styles.headerCell}>{label}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className={styles.body} style={{ height: virtualizer.getTotalSize() }} role="rowgroup">
          {virtualizer.getVirtualItems().map((item) => {
            const reading = readings[item.index]
            return (
              <div
                key={reading.citekey}
                role="row"
                aria-rowindex={item.index + 2}
                data-index={item.index}
                tabIndex={item.index === activeIndex ? 0 : -1}
                className={`${styles.row} ${styles.dataRow}`}
                style={{ transform: `translateY(${item.start}px)` }}
                onClick={() => {
                  setActive(item.index)
                  onOpen(reading)
                }}
                onFocus={() => setActive(item.index)}
                onKeyDown={(event) => onKeyDown(event, reading, item.index)}
              >
                <div role="cell" className={`${styles.cell} ${styles.citation}`}>
                  <span className={styles.citationText}>{reading.shortCitation}</span>
                  {reading.hasNotes && (
                    <FileText
                      size={14}
                      strokeWidth={1.75}
                      className={styles.notesIcon}
                      aria-label="Has notes"
                    />
                  )}
                  {reading.missingFromSource && (
                    <span className={styles.missing}>Not in Zotero</span>
                  )}
                </div>
                <div
                  role="cell"
                  className={`${styles.cell} ${styles.title}`}
                  title={reading.fullTitle}
                >
                  {reading.fullTitle}
                </div>
                <div role="cell" className={`${styles.cell} ${styles.muted}`}>
                  {reading.year ?? '—'}
                </div>
                <div role="cell" className={styles.cell}>
                  <StatusPill status={reading.status} />
                </div>
                <div
                  role="cell"
                  className={`${styles.cell} ${styles.muted}`}
                  title={reading.tags.join(', ')}
                >
                  {reading.tags.join(', ')}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
