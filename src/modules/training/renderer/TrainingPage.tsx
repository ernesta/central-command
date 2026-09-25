import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AcademicYearSelect } from '@renderer/components/AcademicYearSelect'
import { Button } from '@renderer/components/Button'
import { EmptyState } from '@renderer/components/EmptyState'
import { ExportButton } from '@renderer/components/ExportButton'
import { FilterRow } from '@renderer/components/FilterRow'
import { HoursStrip } from '@renderer/components/HoursStrip'
import { Notice } from '@renderer/components/Notice'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { SearchInput } from '@renderer/components/SearchInput'
import { Select } from '@renderer/components/Select'
import { useAcademicYear } from '@renderer/state/use-academic-year'
import { useSettings } from '@renderer/state/settings-context'
import { academicYearLabel } from '@shared/academic-year'
import { skillsIn } from '@shared/skills'
import { initialsFor } from '@modules/meetings/shared/query'
import { meetingHours } from '@modules/meetings/shared/hours'
import {
  DEFAULT_TRAINING_QUERY,
  entriesInYearOrPlanned,
  leadNames,
  meetingsLine,
  queryTraining,
  reconcileTrainingQuery,
  seriesOptions,
  trainingFiltersActive,
  trainingHours,
  yearHoursTitle
} from '../shared/rules'
import { TRAINING_SERIES, TRAINING_TYPES } from '../shared/types'
import { NewTrainingButton } from './NewTrainingButton'
import { TrainingTable } from './TrainingTable'
import { todayIso, trainingBase } from './training-paths'
import { useTrainingList } from './useTrainingList'
import { useTrainingView } from './useTrainingView'
import styles from './TrainingPage.module.css'

/** The training log: the totals for an academic year, filters and the list of entries. */
export function TrainingPage(): React.JSX.Element {
  const { rows, meetings, people } = useTrainingList()
  const { settings } = useSettings()
  // A series card on the landing page opens the list already filtered to that series (for this visit only).
  const [params] = useSearchParams()
  const seriesParam = params.get('series')
  const { query: saved, setQuery } = useTrainingView(
    seriesParam ? { ...DEFAULT_TRAINING_QUERY, series: seriesParam } : undefined
  )
  const [exporting, setExporting] = useState(false)
  const [exportNotice, setExportNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(
    null
  )
  const today = todayIso()
  const everything = rows ?? []
  const { year, years, setYear } = useAcademicYear(
    [...everything.map((r) => r.date), ...meetings.map((m) => m.date)],
    today
  )
  const all = entriesInYearOrPlanned(everything, year)

  // A remembered filter whose value no longer exists in the files must not hide everything.
  const query =
    rows === null
      ? saved
      : reconcileTrainingQuery(saved, {
          series: seriesOptions(everything, TRAINING_SERIES),
          types: TRAINING_TYPES.map((t) => t.name),
          skills: skillsIn(everything),
          leads: leadNames(everything)
        })
  const visible = queryTraining(all, query, people)
  const aim = settings.trainingAimHours
  const hours = trainingHours(everything, year, today, aim)
  const meetingMinutes = meetingHours(meetings, year, today).minutes

  const exportPdf = async (): Promise<void> => {
    setExporting(true)
    setExportNotice(null)
    try {
      const result = await window.api.training.exportPdf(year)
      if (result.status === 'saved') {
        setExportNotice({
          tone: 'info',
          text: `Saved ${academicYearLabel(year)} to ${result.path}`
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
        <EmptyState heading="No training yet" message="Create an entry to start your log." />
      ) : (
        <EmptyState
          heading={`No training in ${academicYearLabel(year)}`}
          message="Create an entry, or choose another academic year."
        />
      )
  } else if (visible.length === 0) {
    content = (
      <EmptyState heading="No matching entries" message="Try a different search or filter.">
        {trainingFiltersActive(query) && (
          <Button onClick={() => setQuery(DEFAULT_TRAINING_QUERY)}>Clear filters</Button>
        )}
      </EmptyState>
    )
  } else content = <TrainingTable rows={visible} people={people} today={today} />

  const noteParts = [
    `${hours.entries} ${hours.entries === 1 ? 'entry' : 'entries'}`,
    hours.withoutTimes > 0 ? `${hours.withoutTimes} without times, counted as 0` : ''
  ].filter(Boolean)

  return (
    <div className={styles.page}>
      <Link className={styles.back} to={trainingBase}>
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
        Training
      </Link>
      <header className={styles.header}>
        <h1 className={styles.heading}>All training</h1>
        <div className={styles.actions}>
          <ExportButton
            busy={exporting}
            disabled={rows === null}
            title={`Exports ${academicYearLabel(year)} as a PDF, oldest first, without upcoming entries`}
            onClick={() => void exportPdf()}
          />
          <NewTrainingButton />
        </div>
      </header>

      {rows !== null && (
        <HoursStrip
          title={yearHoursTitle(year)}
          minutes={hours.minutes}
          note={noteParts.join(' · ')}
          aim={{ hours: aim, progress: hours.progress }}
          extra={meetingMinutes > 0 ? meetingsLine(meetingMinutes) : undefined}
          perSkill={hours.perSkill}
        />
      )}

      <FilterRow>
        <AcademicYearSelect year={year} years={years} onChange={setYear} />
        <SearchInput
          label="Search training"
          value={query.search}
          onChange={(search) => setQuery({ search })}
        />
        <Select
          label="Filter by series"
          value={query.series}
          options={[
            { value: 'all', label: 'All series' },
            ...seriesOptions(everything, TRAINING_SERIES).map((s) => ({ value: s, label: s }))
          ]}
          onChange={(series) => setQuery({ series })}
        />
        <Select
          label="Filter by type"
          value={query.type}
          options={[
            { value: 'all', label: 'Any type' },
            ...TRAINING_TYPES.map((t) => ({ value: t.name, label: t.name, group: t.group }))
          ]}
          onChange={(type) => setQuery({ type })}
        />
        <Select
          label="Filter by skill"
          value={query.skill}
          options={[
            { value: 'all', label: 'Any skill' },
            ...skillsIn(everything).map((s) => ({ value: s, label: s }))
          ]}
          onChange={(skill) => setQuery({ skill })}
        />
        <Select
          label="Filter by people"
          value={query.lead}
          options={[
            { value: 'all', label: 'Anyone' },
            ...leadNames(everything).map((name) => ({
              value: name,
              label: `${name} (${initialsFor(name, people)})`
            }))
          ]}
          onChange={(lead) => setQuery({ lead })}
        />
      </FilterRow>
      {exportNotice && (
        <Notice tone={exportNotice.tone} onDismiss={() => setExportNotice(null)}>
          {exportNotice.text}
        </Notice>
      )}

      <div className={styles.content}>{content}</div>

      {rows !== null && visible.length > 0 && (
        <p className={styles.hint}>
          Newest first. Click any row to open its notes. Upcoming entries are marked and not
          counted. A dash means nothing was recorded.
        </p>
      )}
    </div>
  )
}
