import { useToday } from '@renderer/state/use-today'
import { Link } from 'react-router'
import { formatDate } from '@shared/time'
import { useSettings } from '@renderer/state/settings-context'
import { formatHours } from '@shared/skills'
import { usePeriod } from '@renderer/state/use-period'
import { yearLabel } from '@shared/year'
import { trainingLabel } from '../shared/training-entries'
import {
  compareNewestFirst,
  entriesInYearOrPlanned,
  isUpcoming,
  trainingHours
} from '../shared/rules'
import { useSelfStudy } from './useSelfStudy'
import { clockNow, trainingBase, useTrainingWorkspace } from './training-paths'
import { useTrainingList } from './useTrainingList'
import styles from './TrainingCard.module.css'

/**
 * The Training entry on a workspace's landing page: hours in the chosen year (of the aim, in Research) or in every year, and the latest
 * entry of them. Research follows its academic year filter; Life shows the current year.
 */
export function TrainingCard(): React.JSX.Element {
  const workspace = useTrainingWorkspace()
  const { rows } = useTrainingList(workspace)
  const selfStudy = useSelfStudy()
  const { settings } = useSettings()
  const today = useToday()
  const now = clockNow()
  const period = usePeriod(workspace, [], today)
  const span = period.all ? null : period.year
  const hours = rows
    ? trainingHours(rows, span, today, settings.trainingAimHours, selfStudy, now)
    : null
  // Life's latest entry is its latest of all; Research's is of the chosen year or years.
  const latest = (
    rows ? (workspace === 'research' ? entriesInYearOrPlanned(rows, span, today) : rows) : []
  )
    .filter((r) => !isUpcoming(r, today, now))
    .sort(compareNewestFirst)
    .at(0)

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>
        <Link className={styles.link} to={trainingBase(workspace)}>
          Training
        </Link>
      </h2>
      {rows === null || hours === null ? null : rows.length === 0 ? (
        <p className={styles.line}>No training yet</p>
      ) : (
        <>
          <p className={styles.line}>
            {formatHours(hours.minutes)}
            {workspace === 'research' && !period.all
              ? ` of ${formatHours(settings.trainingAimHours * 60)}`
              : ''}{' '}
            · {span === null ? 'all years' : yearLabel(span)}
          </p>
          {latest && (
            <p className={styles.line}>
              Latest: {trainingLabel(latest.series, latest.title || 'Untitled')}
              {latest.date ? ` · ${formatDate(latest.date)}` : ''}
            </p>
          )}
        </>
      )}
    </div>
  )
}
