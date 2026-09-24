import { Link, useNavigate } from 'react-router'
import { durationMinutes, formatDate, formatDuration } from '../shared/time'
import { MODE_LABELS, formatTimeRange, initialsFor, isUpcoming } from '../shared/query'
import type { MeetingIndexRow, Person } from '../shared/types'
import { meetingRoute } from './meetings-paths'
import styles from './MeetingsTable.module.css'

const VISIBLE_ATTENDEES = 3

/** Date, Time, Duration, Series, Type, Summary, Attendees. Clicking anywhere on a row opens the meeting. */
export function MeetingsTable({
  rows,
  people,
  today
}: {
  rows: MeetingIndexRow[]
  people: Person[]
  today: string
}): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <div className={styles.wrap}>
      <table className={styles.table} aria-label="Meetings">
        <thead>
          <tr>
            {['Date', 'Time', 'Duration', 'Series', 'Type', 'Summary', 'Attendees'].map((label) => (
              <th key={label} className={styles.th} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const duration = durationMinutes(row.start, row.end)
            const shown = row.attendees.slice(0, VISIBLE_ATTENDEES)
            const more = row.attendees.length - shown.length
            return (
              <tr
                key={`${row.workspace}/${row.id}`}
                className={styles.row}
                onClick={() => void navigate(meetingRoute(row.id))}
              >
                <td className={styles.nowrap}>
                  <Link
                    className={styles.link}
                    to={meetingRoute(row.id)}
                    // The row handles the click; the link is for the keyboard and for assistive technology.
                    onClick={(event) => event.stopPropagation()}
                  >
                    {row.date ? formatDate(row.date) : 'No date'}
                  </Link>
                  {isUpcoming(row, today) && <span className={styles.upcoming}>Upcoming</span>}
                </td>
                <td className={styles.nowrap}>{formatTimeRange(row.start, row.end)}</td>
                <td className={styles.nowrap}>
                  {duration === null ? '—' : formatDuration(duration)}
                </td>
                <td className={styles.nowrap}>{row.series || '—'}</td>
                <td className={styles.nowrap}>{row.mode ? MODE_LABELS[row.mode] : '—'}</td>
                <td className={styles.summary}>
                  {row.summary || <span className={styles.missing}>No summary yet.</span>}
                </td>
                <td className={styles.attendees}>
                  <span className={styles.chips}>
                    {shown.map((name) => (
                      <span key={name} className={styles.chip} title={name}>
                        {initialsFor(name, people)}
                      </span>
                    ))}
                  </span>
                  {more > 0 && <span className={styles.more}>+{more}</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
