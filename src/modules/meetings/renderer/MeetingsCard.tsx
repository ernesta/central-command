import { useToday } from '@renderer/state/use-today'
import { Link } from 'react-router'
import { usePeriod } from '@renderer/state/use-period'
import { meetingsInYearOrPlanned, ofContractClients } from '../shared/hours'
import { seriesSummaries } from '../shared/landing'
import { openTodos } from '../shared/open-todos'
import { formatShortDate } from '../shared/time'
import { clockNow, meetingsBase, useMeetingsWorkspace } from './meetings-paths'
import { useMeetingsList } from './useMeetingsList'
import { useTaskLists } from './useTaskLists'
import styles from './MeetingsCard.module.css'

/** The Meetings entry on a workspace's landing page. The title is a real link whose hit area covers the whole card. */
export function MeetingsCard(): React.JSX.Element {
  const workspace = useMeetingsWorkspace()
  const { rows: everyRow } = useMeetingsList(workspace)
  const today = useToday()
  // The chosen contract's meetings (its days and clients) or year's, every meeting under All.
  const period = usePeriod(
    workspace,
    (everyRow ?? []).map((r) => r.date),
    today
  )
  const listOf = useTaskLists(workspace)
  const rows =
    everyRow === null || !period.loaded
      ? null
      : meetingsInYearOrPlanned(
          ofContractClients(everyRow, period.clients, listOf),
          period.all ? null : period.year,
          today,
          period.weeks,
          period.end
        )
  const summaries = rows ? seriesSummaries(rows, today, undefined, clockNow()) : []
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
            {[count > 0 ? `${count} done` : '', next ? `next ${formatShortDate(next)}` : '']
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className={styles.line}>
            {open === 0 ? 'No open TODOs' : `${open} open ${open === 1 ? 'TODO' : 'TODOs'}`}
          </p>
        </>
      )}
    </div>
  )
}
