import { Link } from 'react-router'
import { modulePath } from '@modules/types'
import { formatDate } from '@shared/time'
import { useSettings } from '@renderer/state/settings-context'
import { formatHours } from '@shared/skills'
import { currentAcademicYear, academicYearLabel } from '@shared/academic-year'
import { compareNewestFirst, isUpcoming, trainingHours } from '../shared/rules'
import { todayIso } from './training-paths'
import { useTrainingList } from './useTrainingList'
import styles from './TrainingCard.module.css'

/** The Training entry on the Research landing page: hours this academic year and the latest entry. */
export function TrainingCard(): React.JSX.Element {
  const { rows } = useTrainingList()
  const { settings } = useSettings()
  const today = todayIso()
  const year = currentAcademicYear(today)
  const hours = rows ? trainingHours(rows, year, today, settings.trainingAimHours) : null
  const latest = rows
    ?.filter((r) => !isUpcoming(r, today))
    .sort(compareNewestFirst)
    .at(0)

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>
        <Link className={styles.link} to={modulePath({ workspace: 'research', id: 'training' })}>
          Training
        </Link>
      </h2>
      {rows === null || hours === null ? null : rows.length === 0 ? (
        <p className={styles.line}>No training yet</p>
      ) : (
        <>
          <p className={styles.line}>
            {formatHours(hours.minutes)} of {settings.trainingAimHours} h ·{' '}
            {academicYearLabel(year)}
          </p>
          {latest && (
            <p className={styles.line}>
              Latest: {latest.title || 'Untitled'}
              {latest.date ? ` · ${formatDate(latest.date)}` : ''}
            </p>
          )}
        </>
      )}
    </div>
  )
}
