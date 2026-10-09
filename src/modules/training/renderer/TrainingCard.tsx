import { Link } from 'react-router'
import { modulePath } from '@modules/types'
import { formatDate } from '@shared/time'
import { useSettings } from '@renderer/state/settings-context'
import { formatHours } from '@shared/skills'
import { currentYear, yearLabel } from '@shared/year'
import { lectureLabel } from '../shared/lecture-entries'
import { compareNewestFirst, isUpcoming, trainingHours } from '../shared/rules'
import { useSelfStudy } from './useSelfStudy'
import { todayIso } from './training-paths'
import { useTrainingList } from './useTrainingList'
import styles from './TrainingCard.module.css'

/** The Training entry on the Research landing page: hours this year and the latest entry. */
export function TrainingCard(): React.JSX.Element {
  const { rows } = useTrainingList()
  const selfStudy = useSelfStudy()
  const { settings } = useSettings()
  const today = todayIso()
  const year = currentYear(today, settings.yearStarts)
  const hours = rows ? trainingHours(rows, year, today, settings.trainingAimHours, selfStudy) : null
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
            {formatHours(hours.minutes)} of {settings.trainingAimHours} h · {yearLabel(year)}
          </p>
          {latest && (
            <p className={styles.line}>
              Latest: {lectureLabel(latest.series, latest.title || 'Untitled')}
              {latest.date ? ` · ${formatDate(latest.date)}` : ''}
            </p>
          )}
        </>
      )}
    </div>
  )
}
