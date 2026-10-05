import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@renderer/components/Button'
import { EmptyState } from '@renderer/components/EmptyState'
import { ExportButton } from '@renderer/components/ExportButton'
import { FilterRow } from '@renderer/components/FilterRow'
import { Notice } from '@renderer/components/Notice'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { yearLabel } from '@shared/year'
import { skillFilterOptions, skillsIn } from '@shared/skills'
import { YearSelect } from '@renderer/components/YearSelect'
import { SearchInput } from '@renderer/components/SearchInput'
import { Select } from '@renderer/components/Select'
import { useYear } from '@renderer/state/use-year'
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
import { meetingsInYearOrPlanned } from '../shared/hours'
import { MeetingsHours } from './MeetingsHours'
import { fixedSeries, tracksSkills } from '../shared/types'
import { MeetingsTable } from './MeetingsTable'
import { NewMeetingButton } from './NewMeetingButton'
import { meetingsBase, todayIso, useMeetingsWorkspace } from './meetings-paths'
import { useMeetingsList } from './useMeetingsList'
import { useMeetingsView } from './useMeetingsView'
import styles from './MeetingsPage.module.css'

/**
 * All meetings, newest first: the meeting list and, filtered to Supervision, the supervision log.
 * Upcoming meetings are included and marked.
 */
export function MeetingsPage(): React.JSX.Element {
  const workspace = useMeetingsWorkspace()
  const { rows, people } = useMeetingsList(workspace)
  // A series card on the landing page opens the list already filtered to that series (for this visit only, with the other filters cleared so the series is what you see).
  const [params] = useSearchParams()
  const seriesParam = params.get('series')
  const { query: saved, setQuery } = useMeetingsView(
    workspace,
    seriesParam ? { ...DEFAULT_MEETINGS_QUERY, series: seriesParam } : undefined
  )
  const [exporting, setExporting] = useState(false)
  const [exportNotice, setExportNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(
    null
  )
  const set = (patch: Partial<MeetingsQuery>): void => setQuery(patch)

  const today = todayIso()
  const everything = rows ?? []
  const { year, years, setYear } = useYear(
    everything.map((r) => r.date),
    today
  )
  const all = meetingsInYearOrPlanned(everything, year, today)
  // A remembered series or attendee that no longer exists in the files must not hide everything.
  const query =
    rows === null
      ? saved
      : reconcileQuery(
          saved,
          seriesOptions(everything, fixedSeries(workspace)),
          attendeeNames(everything),
          tracksSkills(workspace) ? skillsIn(everything) : []
        )
  const visible = queryMeetings(all, query, people)
  const filtersActive =
    query.search.trim() !== '' ||
    query.series !== 'all' ||
    query.skill !== 'all' ||
    query.attendee !== 'all' ||
    query.mode !== 'all'

  const exportPdf = async (): Promise<void> => {
    setExporting(true)
    setExportNotice(null)
    try {
      const result = await window.api.meetings.exportPdf(workspace, year)
      if (result.status === 'saved') {
        setExportNotice({
          tone: 'info',
          text: `Saved the ${workspace === 'research' ? 'supervision' : 'meetings'} log for ${yearLabel(year)} to ${result.path}`
        })
      }
    } catch (e) {
      setExportNotice({ tone: 'error', text: `Couldn’t export: ${ipcErrorMessage(e)}` })
    } finally {
      setExporting(false)
    }
  }

  let content: React.ReactNode = null
  if (rows === null) content = null
  else if (all.length === 0) {
    content =
      everything.length === 0 ? (
        <EmptyState heading="No meetings yet" message="Create a meeting to start keeping notes." />
      ) : (
        <EmptyState
          heading={`No meetings in ${yearLabel(year)}`}
          message="Create a meeting, or choose another year."
        />
      )
  } else if (visible.length === 0) {
    content = (
      <EmptyState heading="No matching meetings" message="Try a different search or filter.">
        {filtersActive && (
          <Button onClick={() => setQuery(DEFAULT_MEETINGS_QUERY)}>Clear filters</Button>
        )}
      </EmptyState>
    )
  } else
    content = (
      <MeetingsTable
        rows={visible}
        people={people}
        today={today}
        showSkills={tracksSkills(workspace)}
      />
    )

  return (
    <div className={styles.page}>
      <Link className={styles.back} to={meetingsBase(workspace)}>
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
        Meetings
      </Link>
      <header className={styles.header}>
        <h1 className={styles.heading}>All meetings</h1>
        <div className={styles.actions}>
          <ExportButton
            busy={exporting}
            disabled={rows === null}
            title={`Exports the ${workspace === 'research' ? 'Supervision' : 'meetings'} log for ${yearLabel(year)} as a PDF, oldest first, without upcoming meetings`}
            onClick={() => void exportPdf()}
          />
          <NewMeetingButton />
        </div>
      </header>

      {rows !== null && (
        <MeetingsHours
          rows={everything}
          year={year}
          today={today}
          showSkills={tracksSkills(workspace)}
        />
      )}

      <FilterRow>
        <YearSelect year={year} years={years} onChange={setYear} />
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
            ...seriesOptions(all, fixedSeries(workspace)).map((s) => ({ value: s, label: s }))
          ]}
          onChange={(series) => set({ series })}
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
        {tracksSkills(workspace) && (
          <Select
            label="Filter by skill"
            value={query.skill}
            options={[
              { value: 'all', label: 'Any skill' },
              ...skillFilterOptions(skillsIn(everything))
            ]}
            onChange={(skill) => set({ skill })}
          />
        )}
        <Select
          label="Filter by people"
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
      </FilterRow>
      {exportNotice && (
        <Notice tone={exportNotice.tone} onDismiss={() => setExportNotice(null)}>
          {exportNotice.text}
        </Notice>
      )}

      <div className={styles.content}>{content}</div>
    </div>
  )
}
