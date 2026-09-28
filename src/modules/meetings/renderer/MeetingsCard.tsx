import { Link } from 'react-router'
import { seriesSummaries } from '../shared/landing'
import { openTodos } from '../shared/open-todos'
import { formatShortDate } from '../shared/time'
import { meetingsBase, todayIso, useMeetingsWorkspace } from './meetings-paths'
import { useMeetingsList } from './useMeetingsList'
import styles from './MeetingsCard.module.css'

/** The Meetings entry on a workspace's landing page. The title is a real link whose hit area covers the whole card. */
export function MeetingsCard(): React.JSX.Element {
  const workspace = useMeetingsWorkspace()
  const { rows } = useMeetingsList(workspace)
  const summaries = rows ? seriesSummaries(rows, todayIso()) : []
  const count = summaries.reduce((n, s) => n + s.count, 0)
  const next = summaries
    .map((s) => s.next)
    .filter((d): d is string => d !== null)
    .sort()[0]
  const open = rows ? openTodos(rows).length : 0

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>
        <Link className={styles.link} to={meetingsBase(workspace)}>
          Meetings
        </Link>
      </h2>
      {rows === null ? null : count === 0 && !next ? (
        <p className={styles.line}>No meetings yet</p>
      ) : (
        <>
          <p className={styles.line}>
            {count} {count === 1 ? 'meeting' : 'meetings'}
            {next ? ` · next ${formatShortDate(next)}` : ''}
          </p>
          <p className={styles.line}>
            {open === 0 ? 'No open TODOs' : `${open} open ${open === 1 ? 'TODO' : 'TODOs'}`}
          </p>
        </>
      )}
    </div>
  )
}
