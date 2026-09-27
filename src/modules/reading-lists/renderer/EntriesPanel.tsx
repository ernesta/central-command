import { Link2, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { modulePath } from '@modules/types'
import { DEFAULT_READINGS_QUERY } from '@modules/readings/shared/query'
import type { Reading } from '@modules/readings/shared/types'
import type { ListEntry, ListSection } from '../shared/list-body'
import styles from './EntriesPanel.module.css'

const readingsBase = modulePath({ workspace: 'research', id: 'readings' })
const MAX_RESULTS = 6
const DEBOUNCE_MS = 150

/**
 * A small search-as-you-type picker for an existing reading, shown in place of the "Attach a
 * reading…" button once opened. The search itself runs in the main process (`window.api.readings.list`),
 * the same as the Readings list's own search box.
 */
function AttachControl({ onAttach }: { onAttach: (citekey: string) => void }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  // Keyed by the query it answers, so a stale response arriving after the field was cleared (or the
  // query changed again) is never shown.
  const [found, setFound] = useState<{ query: string; readings: Reading[] }>({
    query: '',
    readings: []
  })
  const results = found.query === query ? found.readings : []

  useEffect(() => {
    if (!open || query.trim() === '') return
    const timer = setTimeout(() => {
      void window.api.readings.list({ ...DEFAULT_READINGS_QUERY, search: query }).then((list) => {
        setFound({ query, readings: list.slice(0, MAX_RESULTS) })
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [open, query])

  if (!open) {
    return (
      <button type="button" className={styles.attachButton} onClick={() => setOpen(true)}>
        <Link2 size={12} strokeWidth={1.75} aria-hidden />
        Attach a reading…
      </button>
    )
  }

  const close = (): void => {
    setOpen(false)
    setQuery('')
  }

  return (
    <div className={styles.attach}>
      <div className={styles.attachField}>
        <Search size={13} strokeWidth={1.75} aria-hidden />
        <input
          autoFocus
          className={styles.attachInput}
          placeholder="Search your readings…"
          aria-label="Search your readings"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              close()
            }
          }}
        />
        <button type="button" className={styles.attachClose} aria-label="Cancel" onClick={close}>
          <X size={13} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      {query.trim() === '' ? (
        <p className={styles.attachHint}>Type an author or a title.</p>
      ) : results.length === 0 ? (
        <p className={styles.attachHint}>No matching readings.</p>
      ) : (
        <ul className={styles.attachResults}>
          {results.map((r) => (
            <li key={r.citekey}>
              <button
                type="button"
                className={styles.attachResult}
                onClick={() => {
                  onAttach(r.citekey)
                  close()
                }}
              >
                {r.shortCitation}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EntryRow({
  entry,
  readingsByCitekey,
  onAttach
}: {
  entry: ListEntry
  readingsByCitekey: Map<string, Reading>
  onAttach: (offset: number, citekey: string) => void
}): React.JSX.Element {
  const attach = <AttachControl onAttach={(k) => onAttach(entry.offset, k)} />
  if (entry.kind === 'linked') {
    const reading = readingsByCitekey.get(entry.citekey)
    return (
      <li className={styles.entry}>
        {reading ? (
          <Link
            className={styles.citation}
            to={`${readingsBase}/${encodeURIComponent(entry.citekey)}`}
          >
            {reading.shortCitation}
          </Link>
        ) : (
          <>
            <p className={styles.missing}>“{entry.citekey}” is not in your readings.</p>
            {attach}
          </>
        )}
        {entry.annotation && <p className={styles.annotation}>{entry.annotation}</p>}
      </li>
    )
  }
  return (
    <li className={styles.entry}>
      {entry.kind === 'placeholder' ? (
        <p className={styles.citation}>{entry.citation}</p>
      ) : (
        <p className={styles.missing}>No citation yet.</p>
      )}
      {entry.annotation && <p className={styles.annotation}>{entry.annotation}</p>}
      {attach}
    </li>
  )
}

/**
 * A live-parsed view of the list's own sections and entries, resolving `**@citekey**` entries to
 * the reading's real citation (linked to its page) instead of the raw citekey. A placeholder or an
 * entry with no citation yet offers "Attach a reading…" (`AttachControl`), which rewrites that one
 * bullet's citation in the body, via `onAttach`.
 */
export function EntriesPanel({
  sections,
  onAttach
}: {
  sections: ListSection[]
  onAttach: (offset: number, citekey: string) => void
}): React.JSX.Element {
  const [readings, setReadings] = useState<Reading[] | null>(null)
  useEffect(() => {
    let cancelled = false
    void window.api.readings.list(DEFAULT_READINGS_QUERY).then((list) => {
      if (!cancelled) setReadings(list)
    })
    return () => {
      cancelled = true
    }
  }, [])
  const readingsByCitekey = useMemo(
    () => new Map((readings ?? []).map((r) => [r.citekey, r])),
    [readings]
  )

  return (
    <nav className={styles.panel} aria-label="Entries">
      <h2 className={styles.label}>Entries</h2>
      {sections.length === 0 ? (
        <p className={styles.empty}>
          Write a section as a heading, then each paper as a bullet: <b>Citation.</b> An annotation.
        </p>
      ) : (
        sections.map((section, i) => (
          <div key={`${i}-${section.heading}`} className={styles.section}>
            <h3 className={styles.sectionHeading}>{section.heading}</h3>
            {section.entries.length === 0 ? (
              <p className={styles.empty}>No entries yet.</p>
            ) : (
              <ul className={styles.list}>
                {section.entries.map((entry) => (
                  <EntryRow
                    key={entry.offset}
                    entry={entry}
                    readingsByCitekey={readingsByCitekey}
                    onAttach={onAttach}
                  />
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </nav>
  )
}
