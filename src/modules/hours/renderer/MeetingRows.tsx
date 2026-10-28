import { Link } from 'react-router'
import { CalendarClock, GraduationCap, TriangleAlert } from 'lucide-react'
import { formatHours } from '@shared/tracking/format'
import { derivedRows } from '@shared/tracking/derived'
import { timeToSeconds } from '@shared/tracking/rounding'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import { Tooltip } from '@renderer/components/Tooltip'
import { formatTimeRange } from '../../meetings/shared/query'
import { meetingRoute } from '../../meetings/renderer/meetings-paths'
import { entryRoute } from '../../training/renderer/training-paths'
import {
  noteKey,
  occupiedByMeetings,
  occupiedBySessions,
  overlapping
} from '../../meetings/shared/meeting-entries'
import type { HoursWorkspace } from '../shared/workspaces'
import listStyles from './TaskList.module.css'
import styles from './MeetingRows.module.css'

interface MeetingRowsProps {
  workspace: HoursWorkspace
  /** The year as shown (with its meetings' hours derived into it). */
  data: TrackingYear
  date: string
  now: Moment
}

/**
 * A day's meetings and trainings, read-only: the task's title, the note's times and the hours it reports, linking to the note, which
 * is where they are changed. A line that overlaps a timer block or another meeting says so and changes nothing.
 */
export function MeetingRows({
  workspace: shown,
  data,
  date,
  now
}: MeetingRowsProps): React.JSX.Element | null {
  const rows = derivedRows(data, date)
  // Life has no meetings or trainings: nothing is derived there.
  if (rows.length === 0 || shown === 'life') return null
  const workspace = shown
  const sessions = occupiedBySessions(data.sessions, date)
  const meetings = occupiedByMeetings(
    rows.map((r) => ({ ...r, date })),
    date,
    workspace
  )
  const seconds = timeToSeconds(now.time) ?? 0

  return (
    <ul className={listStyles.list} aria-label="Meetings and training">
      {rows.map((row) => {
        const clashes = overlapping(
          row.start,
          row.end,
          [...sessions, ...meetings],
          seconds,
          noteKey(row.kind, workspace, row.id)
        )
        const training = row.kind === 'training'
        const Icon = training ? GraduationCap : CalendarClock
        return (
          <li key={`${row.kind}:${row.id}`} className={listStyles.row}>
            <span className={`${listStyles.lead} ${styles.icon}`}>
              <Icon size={16} strokeWidth={1.75} aria-hidden />
            </span>
            <Link
              className={styles.name}
              to={training ? entryRoute(row.id) : meetingRoute(workspace, row.id)}
              aria-label={`Open the ${training ? 'training' : 'meeting'} ${row.id}`}
            >
              <span className={styles.title}>{row.label}</span>
              <span className={styles.when}>{formatTimeRange(row.start, row.end)}</span>
              {row.client && <span className={styles.client}>{row.client}</span>}
            </Link>
            {clashes.length > 0 && (
              <Tooltip
                text={`Overlaps ${clashes.map((c) => c.label || 'another entry').join(', ')}`}
              >
                <span
                  className={styles.warn}
                  role="img"
                  aria-label={`Overlaps ${clashes.map((c) => c.label || 'another entry').join(', ')}`}
                >
                  <TriangleAlert size={15} strokeWidth={1.75} aria-hidden />
                </span>
              </Tooltip>
            )}
            <span className={listStyles.end}>
              <span className={listStyles.time}>{formatHours(row.minutes)}</span>
              <span className={listStyles.delete} aria-hidden />
            </span>
          </li>
        )
      })}
    </ul>
  )
}
