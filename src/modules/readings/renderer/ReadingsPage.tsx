import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { modulePath } from '@modules/types'
import { AllLink } from '@renderer/components/Landing'
import { Button } from '@renderer/components/Button'
import { EmptyState } from '@renderer/components/EmptyState'
import { Notice } from '@renderer/components/Notice'
import { SearchInput } from '@renderer/components/SearchInput'
import { Segmented } from '@renderer/components/Segmented'
import { Select } from '@renderer/components/Select'
import { readingListsBase } from '@modules/reading-lists/renderer/reading-lists-paths'
import { DEFAULT_READINGS_QUERY, type ReadingsView, type StatusFilter } from '../shared/query'
import { SORT_PRESETS, nextSort, parseSortValue, sortOption } from '../shared/sort-options'
import type { Reading } from '../shared/types'
import { ReadingsBoard } from './ReadingsBoard'
import { ReadingsTable } from './ReadingsTable'
import { SyncIndicator } from './SyncIndicator'
import { TagFilter } from './TagFilter'
import { useReadingsList } from './useReadingsList'
import { useReadingsView } from './useReadingsView'
import { useRenameSuggestions } from './useRenameSuggestions'
import { useSyncStatus } from './useSyncStatus'
import styles from './ReadingsPage.module.css'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'read', label: 'Read' },
  { value: 'to_read', label: 'To Read' },
  { value: 'unset', label: 'Unset' }
] as const satisfies readonly { value: StatusFilter; label: string }[]

const VIEW_OPTIONS = [
  { value: 'table', label: 'Table' },
  { value: 'board', label: 'Board' }
] as const satisfies readonly { value: ReadingsView; label: string }[]

const readingsBase = modulePath({ workspace: 'research', id: 'readings' })

/** Ends an error message with a full stop so it can be followed by another sentence. */
const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`)

export function ReadingsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { prefs, setPrefs } = useReadingsView()
  const { status, counts, syncNow } = useSyncStatus()
  const [actionVersion, setActionVersion] = useState(0)
  // Refetch after every sync attempt, not only when the count of readings changes -- and after a
  // suggestion is linked or dismissed, since that can rename a reading without a new sync.
  const refreshKey = `${status?.state ?? ''}|${status?.lastRun?.finishedAt ?? ''}|${actionVersion}`
  const { readings, tags } = useReadingsList(prefs, refreshKey)
  const suggestions = useRenameSuggestions(refreshKey)
  const [dismissedMissing, setDismissedMissing] = useState(0)

  const linkSuggestion = async (id: number): Promise<void> => {
    await window.api.readings.renameSuggestions.link(id)
    setActionVersion((v) => v + 1)
  }
  const dismissSuggestion = async (id: number): Promise<void> => {
    await window.api.readings.renameSuggestions.dismiss(id)
    setActionVersion((v) => v + 1)
  }

  const open = (reading: Reading): void => {
    void navigate(`${readingsBase}/${encodeURIComponent(reading.citekey)}`)
  }

  const sortChoice = sortOption(prefs.sort)
  const sortOptions = SORT_PRESETS.some((p) => p.value === sortChoice.value)
    ? SORT_PRESETS.map(({ value, label }) => ({ value, label }))
    : [...SORT_PRESETS.map(({ value, label }) => ({ value, label })), sortChoice]

  const filtersActive =
    prefs.search.trim() !== '' ||
    prefs.status !== 'all' ||
    prefs.tags.length > 0 ||
    prefs.missingOnly
  const clearFilters = (): void =>
    setPrefs({ search: '', status: 'all', tags: [], missingOnly: false })

  const missing = counts?.missingFromSource ?? 0
  const showMissingNotice = missing > 0 && (missing > dismissedMissing || prefs.missingOnly)

  let content: React.ReactNode = null
  if (readings === null || counts === null) {
    content = null
  } else if (counts.total === 0) {
    content =
      status?.state === 'error' ? (
        <EmptyState
          heading="The sync failed"
          message={`${sentence(status.message ?? 'Unknown error')} Nothing was imported and nothing was changed.`}
        >
          <Button onClick={() => navigate('/settings')}>Check sync settings</Button>
        </EmptyState>
      ) : (
        <EmptyState
          heading="No readings yet"
          message={
            status?.state === 'not_configured'
              ? 'Connect Zotero to see your library here.'
              : 'Your Zotero export has no entries.'
          }
        >
          {status?.state === 'not_configured' && (
            <Button variant="primary" onClick={() => navigate('/settings')}>
              Set up Zotero sync
            </Button>
          )}
        </EmptyState>
      )
  } else if (readings.length === 0) {
    content = (
      <EmptyState heading="No matching readings" message="Try a different search or filter.">
        {filtersActive && <Button onClick={clearFilters}>Clear filters</Button>}
      </EmptyState>
    )
  } else if (prefs.view === 'board') {
    content = <ReadingsBoard readings={readings} onOpen={open} />
  } else {
    content = (
      <ReadingsTable
        readings={readings}
        sort={prefs.sort}
        onSortChange={(key) => setPrefs({ sort: nextSort(prefs.sort, key) })}
        onOpen={open}
      />
    )
  }

  return (
    <div className={styles.page}>
      <Link className={styles.back} to="/research">
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
        Research
      </Link>
      <header className={styles.header}>
        <div className={styles.headingRow}>
          <h1 className={styles.heading}>Readings</h1>
          <AllLink to={readingListsBase}>Lists</AllLink>
        </div>
        <div className={styles.controls}>
          <SearchInput
            label="Search readings"
            value={prefs.search}
            onChange={(search) => setPrefs({ search })}
          />
          <Select
            label="Filter by status"
            value={prefs.status}
            options={STATUS_OPTIONS}
            onChange={(value) => setPrefs({ status: value })}
          />
          <TagFilter
            tags={tags}
            selected={prefs.tags}
            onChange={(next) => setPrefs({ tags: next })}
          />
          <Select
            label="Sort by"
            value={sortChoice.value}
            options={sortOptions}
            onChange={(value) => {
              const sort = parseSortValue(value)
              if (sort) setPrefs({ sort })
            }}
          />
          <Segmented
            label="View"
            value={prefs.view}
            options={VIEW_OPTIONS}
            onChange={(view) => setPrefs({ view })}
          />
          <SyncIndicator status={status} onSync={() => void syncNow()} />
        </div>
      </header>

      {showMissingNotice && (
        <div className={styles.notice}>
          <Notice
            action={
              <button
                type="button"
                className={styles.link}
                onClick={() => setPrefs({ missingOnly: !prefs.missingOnly })}
              >
                {prefs.missingOnly ? 'Show all' : 'Show them'}
              </button>
            }
            onDismiss={() => {
              setDismissedMissing(missing)
              if (prefs.missingOnly) setPrefs({ missingOnly: DEFAULT_READINGS_QUERY.missingOnly })
            }}
          >
            {missing === 1
              ? '1 reading is no longer in your Zotero export. Your notes are safe.'
              : `${missing} readings are no longer in your Zotero export. Your notes are safe.`}
          </Notice>
        </div>
      )}

      {suggestions.map((suggestion) => (
        <div key={suggestion.id} className={styles.notice}>
          <Notice
            action={
              <button
                type="button"
                className={styles.link}
                onClick={() => void linkSuggestion(suggestion.id)}
              >
                Link
              </button>
            }
            onDismiss={() => void dismissSuggestion(suggestion.id)}
          >
            {suggestion.oldShortCitation} looks like it may now be {suggestion.newShortCitation} —
            link them?
          </Notice>
        </div>
      ))}

      <div className={styles.content}>{content}</div>
    </div>
  )
}
