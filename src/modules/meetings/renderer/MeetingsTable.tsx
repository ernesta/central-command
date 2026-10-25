import { Fragment } from 'react'
import { Link, useNavigate } from 'react-router'
import { SkillChips } from '@renderer/components/SkillChips'
import { useRowNavigation } from '@renderer/components/useRowNavigation'
import { Tooltip } from '@renderer/components/Tooltip'
import { layoutRows } from '@shared/upcoming-groups'
import { GroupRow } from '@renderer/components/GroupRow'
import { durationMinutes, formatDate, formatDuration } from '../shared/time'
import { formatTimeRange, initialsFor, isUpcoming } from '../shared/query'
import type { MeetingIndexRow, Person } from '../shared/types'
import { meetingRoute } from './meetings-paths'
import styles from './MeetingsTable.module.css'

const VISIBLE_ATTENDEES = 3
const COLUMNS = ['Date', 'Time', 'Duration', 'Series', 'Summary', 'Skills', 'Attendees']

/**
 * Date, Time, Duration, Series, Summary, Skills, Attendees. Clicking anywhere on a row opens the meeting.
 * Like the Notes table, it is one tab stop: arrow keys, Home/End and PageUp/PageDown move between
 * rows (the whole row is highlighted) and Enter opens the meeting.
 */
export function MeetingsTable({
  rows,
  people,
  today,
  showSkills,
  grouped = true
}: {
  rows: MeetingIndexRow[]
  people: Person[]
  today: string
  showSkills: boolean
  /** Upcoming / Earlier headers: only while the list is sorted by date, newest first. */
  grouped?: boolean
}): React.JSX.Element {
  const navigate = useNavigate()
  const { ordered, groups } = layoutRows(rows, grouped, (row) => isUpcoming(row, today))
  const columns = showSkills ? COLUMNS.length : COLUMNS.length - 1
  const { tableProps, rowProps } = useRowNavigation(ordered.length, (index) => {
    const row = ordered[index]
    void navigate(meetingRoute(row.workspace, row.id))
  })

  return (
    <div className={styles.wrap}>
      <table className={styles.table} aria-label="Meetings" {...tableProps}>
        <thead>
          <tr>
            {COLUMNS.filter((label) => showSkills || label !== 'Skills').map((label) => (
              <th key={label} className={styles.th} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.key}>
              {group.label && <GroupRow label={group.label} colSpan={columns} />}
              {group.rows.map((row, offset) => {
                const index = group.start + offset
                const duration = durationMinutes(row.start, row.end)
                const shown = row.attendees.slice(0, VISIBLE_ATTENDEES)
                const more = row.attendees.length - shown.length
                return (
                  <tr
                    key={`${row.workspace}/${row.id}`}
                    className={styles.row}
                    {...rowProps(index)}
                    onClick={() => void navigate(meetingRoute(row.workspace, row.id))}
                  >
                    <td className={styles.nowrap}>
                      <Link
                        className={styles.link}
                        tabIndex={-1}
                        to={meetingRoute(row.workspace, row.id)}
                        // The row handles the click; the link is for the keyboard and for assistive technology.
                        onClick={(event) => event.stopPropagation()}
                      >
                        {row.date ? formatDate(row.date) : 'No date'}
                      </Link>
                    </td>
                    <td className={styles.nowrap}>{formatTimeRange(row.start, row.end)}</td>
                    <td className={styles.nowrap}>
                      {duration === null ? '—' : formatDuration(duration)}
                    </td>
                    <td className={styles.nowrap}>{row.series || '—'}</td>
                    <td className={styles.summary}>
                      {row.summary || <span className={styles.missing}>No summary yet.</span>}
                    </td>
                    {showSkills && (
                      <td className={styles.skills}>
                        <SkillChips skills={row.skills} stacked />
                      </td>
                    )}
                    <td className={styles.attendees}>
                      <span className={styles.chips}>
                        {shown.map((name) => (
                          <Tooltip key={name} text={name}>
                            <span className={styles.chip}>{initialsFor(name, people)}</span>
                          </Tooltip>
                        ))}
                      </span>
                      {more > 0 && <span className={styles.more}>+{more}</span>}
                    </td>
                  </tr>
                )
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
