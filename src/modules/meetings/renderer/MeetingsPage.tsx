import { ArrowLeft, Download } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@renderer/components/Button'
import { EmptyState } from '@renderer/components/EmptyState'
import { SearchInput } from '@renderer/components/SearchInput'
import { Select } from '@renderer/components/Select'
import {
  DEFAULT_MEETINGS_QUERY,
  MODE_LABELS,
  reconcileQuery,
  attendeeNames,
  initialsFor,
  queryMeetings,
  seriesOptions,
  type MeetingsQuery
} from '../shared/query'
import { MeetingsTable } from './MeetingsTable'
import { NewMeetingButton } from './NewMeetingButton'
import { meetingsBase, todayIso } from './meetings-paths'
import { useMeetingsList } from './useMeetingsList'
import { useMeetingsView } from './useMeetingsView'
import styles from './MeetingsPage.module.css'

/**
 * All meetings, newest first: the meeting list and, filtered to Supervision, the supervision log.
 * Upcoming meetings are included and marked.
 */
export function MeetingsPage(): React.JSX.Element {
  const { rows, people } = useMeetingsList()
  // A series card on the landing page opens the list already filtered to that series (for this visit only, with the other filters cleared so the series is what you see).
  const [params] = useSearchParams()
  const seriesParam = params.get('series')
  const { query: saved, setQuery } = useMeetingsView(
    seriesParam ? { ...DEFAULT_MEETINGS_QUERY, series: seriesParam } : undefined
  )
  const set = (patch: Partial<MeetingsQuery>): void => setQuery(patch)

  const today = todayIso()
  const all = rows ?? []
  // A remembered series or attendee that no longer exists in the files must not hide everything.
  const query =
    rows === null ? saved : reconcileQuery(saved, seriesOptions(all), attendeeNames(all))
  const visible = queryMeetings(all, query, people)
  const filtersActive =
    query.search.trim() !== '' ||
    query.series !== 'all' ||
    query.attendee !== 'all' ||
    query.mode !== 'all'

  let content: React.ReactNode = null
  if (rows === null) content = null
  else if (all.length === 0) {
    content = (
      <EmptyState heading="No meetings yet" message="Create a meeting to start keeping notes." />
    )
  } else if (visible.length === 0) {
    content = (
      <EmptyState heading="No matching meetings" message="Try a different search or filter.">
        {filtersActive && (
          <Button onClick={() => setQuery(DEFAULT_MEETINGS_QUERY)}>Clear filters</Button>
        )}
      </EmptyState>
    )
  } else content = <MeetingsTable rows={visible} people={people} today={today} />

  return (
    <div className={styles.page}>
      <Link className={styles.back} to={meetingsBase}>
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
        Meetings
      </Link>
      <header className={styles.header}>
        <h1 className={styles.heading}>All meetings</h1>
        <NewMeetingButton />
      </header>

      <div className={styles.filters}>
        <SearchInput
          label="Search meetings"
          value={query.search}
          onChange={(search) => set({ search })}
        />
        <Select
          label="Filter by series"
          value={query.series}
          options={[
            { value: 'all', label: 'All series' },
            ...seriesOptions(all).map((s) => ({ value: s, label: s }))
          ]}
          onChange={(series) => set({ series })}
        />
        <Select
          label="Filter by attendee"
          value={query.attendee}
          options={[
            { value: 'all', label: 'Anyone' },
            ...attendeeNames(all).map((name) => ({
              value: name,
              label: `${name} (${initialsFor(name, people)})`
            }))
          ]}
          onChange={(attendee) => set({ attendee })}
        />
        <Select
          label="Filter by type"
          value={query.mode}
          options={[
            { value: 'all', label: 'Any type' },
            { value: 'in-person', label: MODE_LABELS['in-person'] },
            { value: 'online', label: MODE_LABELS.online }
          ]}
          onChange={(mode) => set({ mode })}
        />
        {/* Used about once a year, so deliberately quiet. Built later; it will act on the Supervision view, oldest first. */}
        <button
          type="button"
          className={styles.export}
          disabled
          title="Later: exports the Supervision log as a PDF, oldest first"
        >
          <Download size={14} strokeWidth={1.75} aria-hidden />
          Export
        </button>
      </div>

      <div className={styles.content}>{content}</div>

      {rows !== null && visible.length > 0 && (
        <p className={styles.hint}>
          Newest first. Click any row to open its notes. Choosing the Supervision series gives you
          the supervision log. Upcoming meetings are marked. A dash means nothing was recorded.
        </p>
      )}
    </div>
  )
}
