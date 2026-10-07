import { Link } from 'react-router'
import { CalendarClock, GraduationCap, TriangleAlert } from 'lucide-react'
import { formatHours } from '@shared/tracking/format'
import { derivedRows } from '@shared/tracking/derived'
import { timeToSeconds } from '@shared/tracking/rounding'
import type { Moment, TrackingYear } from '@shared/tracking/types'
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
 * A day's meetings and lectures, read-only: the task's title, the note's times and the hours it reports, linking to the note, which
 * is where they are changed. A line that overlaps a timer block or another meeting says so and changes nothing.
 */
export function MeetingRows({
  workspace,
  data,
  date,
  now
}: MeetingRowsProps): React.JSX.Element | null {
  const rows = derivedRows(data, date)
  if (rows.length === 0) return null
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
        const lecture = row.kind === 'training'
        const Icon = lecture ? GraduationCap : CalendarClock
        return (
          <li key={`${row.kind}:${row.id}`} className={styles.row}>
            <Icon size={16} strokeWidth={1.75} className={styles.icon} aria-hidden />
            <Link
              className={styles.name}
              to={lecture ? entryRoute(row.id) : meetingRoute(workspace, row.id)}
              aria-label={`Open the ${lecture ? 'lecture' : 'meeting'} ${row.id}`}
            >
              <span className={styles.title}>{row.label}</span>
              <span className={styles.when}>
                {row.start}–{row.end}
              </span>
              {row.client && <span className={styles.client}>{row.client}</span>}
            </Link>
            {clashes.length > 0 && (
              <span
                className={styles.warn}
                role="img"
                aria-label={`Overlaps ${clashes.map((c) => c.label || 'another entry').join(', ')}`}
                title={`Overlaps ${clashes.map((c) => c.label || 'another entry').join(', ')}`}
              >
                <TriangleAlert size={15} strokeWidth={1.75} aria-hidden />
              </span>
            )}
            <span className={styles.time}>{formatHours(row.minutes)}</span>
          </li>
        )
      })}
    </ul>
  )
}
