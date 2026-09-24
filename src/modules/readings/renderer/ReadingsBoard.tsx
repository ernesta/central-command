import { FileText } from 'lucide-react'
import type { Reading, ReadingStatus } from '../shared/types'
import styles from './ReadingsBoard.module.css'

const COLUMNS: { status: ReadingStatus; title: string }[] = [
  { status: 'to_read', title: 'To Read' },
  { status: 'read', title: 'Read' },
  { status: 'unset', title: 'Unset' }
]

interface ReadingsBoardProps {
  readings: Reading[]
  onOpen: (reading: Reading) => void
}

/** Readings grouped by status; all three columns are always shown, with counts. Read-only: status is owned by Zotero, so there is no drag and drop. */
export function ReadingsBoard({ readings, onOpen }: ReadingsBoardProps): React.JSX.Element {
  const grouped = COLUMNS.map((column) => ({
    ...column,
    items: readings.filter((r) => r.status === column.status)
  }))
  return (
    <div className={styles.board}>
      {grouped.map(({ status, title, items }) => (
        <section key={status} className={styles.column} aria-label={title}>
          <header className={styles.columnHeader}>
            <h2 className={styles.columnTitle}>{title}</h2>
            <span className={styles.count}>{items.length}</span>
          </header>
          {items.length === 0 ? (
            <p className={styles.emptyColumn}>Nothing here.</p>
          ) : (
            <ul className={styles.cards}>
              {items.map((reading) => (
                <li key={reading.citekey}>
                  <button type="button" className={styles.card} onClick={() => onOpen(reading)}>
                    <span className={styles.citation}>
                      {reading.shortCitation}
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
                    </span>
                    <span className={styles.title}>{reading.fullTitle}</span>
                    {reading.tags.length > 0 && (
                      <span className={styles.tags}>{reading.tags.join(', ')}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
