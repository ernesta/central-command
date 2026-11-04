import { useToday } from '@renderer/state/use-today'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { YearSelect } from '@renderer/components/YearSelect'
import { Button } from '@renderer/components/Button'
import { EmptyState } from '@renderer/components/EmptyState'
import { ExportButton } from '@renderer/components/ExportButton'
import { FilterRow } from '@renderer/components/FilterRow'
import { HoursStrip } from '@renderer/components/HoursStrip'
import { Notice } from '@renderer/components/Notice'
import { showToast } from '@renderer/components/toast-store'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { SearchInput } from '@renderer/components/SearchInput'
import { Select } from '@renderer/components/Select'
import { usePeriod } from '@renderer/state/use-period'
import { useSettings } from '@renderer/state/settings-context'
import { yearLabel } from '@shared/year'
import { skillFilterOptions, skillsIn } from '@shared/skills'
import { initialsFor } from '@modules/meetings/shared/query'
import {
  DEFAULT_TRAINING_QUERY,
  entriesInYearOrPlanned,
  leadNames,
  queryTraining,
  reconcileTrainingQuery,
  seriesOptions,
  trainingFiltersActive,
  trainingHours,
  yearHoursTitle
} from '../shared/rules'
import { TRAINING_TYPES } from '../shared/types'
import { NewTrainingButton } from './NewTrainingButton'
import { TrainingTable } from './TrainingTable'
import { clockNow, useTrainingWorkspace } from './training-paths'
import { useSelfStudy } from './useSelfStudy'
import { useTrainingList } from './useTrainingList'
import { useTrainingView } from './useTrainingView'
import styles from './TrainingPage.module.css'

/** The training log: the totals for an academic year, filters and the list of entries. */
export function TrainingPage(): React.JSX.Element {
  const workspace = useTrainingWorkspace()
  // Life keeps a plain log: no yearly aim, no hours of meetings, no skills or types and no PDF for Inkpath.
  const research = workspace === 'research'
  const { rows, meetings, people } = useTrainingList(workspace)
  const selfStudy = useSelfStudy()
  const { settings } = useSettings()
  // A series card on the landing page opens the list already filtered to that series (for this visit only).
  const [params] = useSearchParams()
  const seriesParam = params.get('series')
  const { query: saved, setQuery } = useTrainingView(
    seriesParam ? { ...DEFAULT_TRAINING_QUERY, series: seriesParam } : undefined
  )
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const today = useToday()
  const now = clockNow()
  const everything = rows ?? []
  // Research follows its one academic year filter (every year under All); Life keeps a selector of its own.
  const period = usePeriod(
    workspace,
    [...everything.map((r) => r.date), ...meetings.map((m) => m.date)],
    today
  )
  const { year, years, setYear } = period
  const span = period.all ? null : year
  const all = entriesInYearOrPlanned(everything, span, today)

  // A remembered filter whose value no longer exists in the files must not hide everything.
  const query =
    rows === null
      ? saved
      : reconcileTrainingQuery(saved, {
          series: seriesOptions(everything),
          types: TRAINING_TYPES.map((t) => t.name),
          skills: skillsIn(everything),
          leads: leadNames(everything)
        })
  const visible = queryTraining(all, query, people)
  const aim = settings.trainingAimHours
  const hours = trainingHours(everything, span, today, aim, selfStudy, now)

  const exportPdf = async (): Promise<void> => {
    setExporting(true)
    setExportError(null)
    try {
      // The report is of one year: the current one under All years, which the notice names.
      const result = await window.api.training.exportPdf(year)
      if (result.status === 'saved') {
        showToast(`Saved ${yearLabel(year)} to ${result.path}`)
      }
    } catch (e) {
      setExportError(`Couldn’t export: ${ipcErrorMessage(e)}`)
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
          heading={`No training in ${yearLabel(year)}`}
          message="Create an entry, or choose another year."
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
  } else
    content = (
      <TrainingTable
        rows={visible}
        people={people}
        today={today}
        selfStudy={selfStudy}
        workspace={workspace}
      />
    )

  const noteParts = [`${hours.entries} done`]

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>All training</h1>
        <div className={styles.actions}>
          {research && (
            <ExportButton
              busy={exporting}
              disabled={rows === null}
              onClick={() => void exportPdf()}
            />
          )}
          <NewTrainingButton workspace={workspace} />
        </div>
      </header>

      {rows !== null && (
        <HoursStrip
          title={yearHoursTitle(span)}
          minutes={hours.minutes}
          note={noteParts.join(' · ')}
          // The yearly aim means nothing across years: no aim under All years.
          aim={research && !period.all ? { hours: aim, progress: hours.progress } : undefined}
          perSkill={research ? hours.perSkill : []}
        />
      )}

      <FilterRow>
        {!research && <YearSelect year={year} years={years} onChange={setYear} />}
        <SearchInput
          label="Search training"
          value={query.search}
          onChange={(search) => setQuery({ search })}
        />
        <Select
          label="Filter by series"
          search
          noun="series"
          value={query.series}
          options={[
            { value: 'all', label: 'All series' },
            ...seriesOptions(everything).map((s) => ({ value: s, label: s }))
          ]}
          onChange={(series) => setQuery({ series })}
        />
        {research && (
          <>
            <Select
              label="Filter by type"
              search
              noun="types"
              value={query.type}
              options={[
                { value: 'all', label: 'Any type' },
                ...TRAINING_TYPES.map((t) => ({ value: t.name, label: t.name, group: t.group }))
              ]}
              onChange={(type) => setQuery({ type })}
            />
            <Select
              label="Filter by skill"
              search
              noun="skills"
              value={query.skill}
              options={[
                { value: 'all', label: 'Any skill' },
                ...skillFilterOptions(skillsIn(everything))
              ]}
              onChange={(skill) => setQuery({ skill })}
            />
          </>
        )}
        <Select
          label="Filter by people"
          search
          noun="people"
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
      {exportError && (
        <Notice tone="error" onDismiss={() => setExportError(null)}>
          {exportError}
        </Notice>
      )}

      <div className={styles.content}>{content}</div>
    </div>
  )
}
