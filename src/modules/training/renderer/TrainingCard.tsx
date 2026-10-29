import { useToday } from '@renderer/state/use-today'
import { Link } from 'react-router'
import { formatDate } from '@shared/time'
import { useSettings } from '@renderer/state/settings-context'
import { formatHours } from '@shared/skills'
import { currentYear, yearLabel } from '@shared/year'
import { trainingLabel } from '../shared/training-entries'
import { compareNewestFirst, isUpcoming, trainingHours } from '../shared/rules'
import { useSelfStudy } from './useSelfStudy'
import { clockNow, trainingBase, useTrainingWorkspace } from './training-paths'
import { useTrainingList } from './useTrainingList'
import styles from './TrainingCard.module.css'

/** The Training entry on a workspace's landing page: hours this year (of the aim, in Research) and the latest entry. */
export function TrainingCard(): React.JSX.Element {
  const workspace = useTrainingWorkspace()
  const { rows } = useTrainingList(workspace)
  const selfStudy = useSelfStudy()
  const { settings } = useSettings()
  const today = useToday()
  const now = clockNow()
  const year = currentYear(today, settings.yearStarts)
  const hours = rows
    ? trainingHours(rows, year, today, settings.trainingAimHours, selfStudy, now)
    : null
  const latest = rows
    ?.filter((r) => !isUpcoming(r, today, now))
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
            {workspace === 'research'
              ? ` of ${formatHours(settings.trainingAimHours * 60)}`
              : ''} · {yearLabel(year)}
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
