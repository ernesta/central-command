import { Fragment } from 'react'
import { Link, useNavigate } from 'react-router'
import { CutText } from '@renderer/components/CutText'
import { InitialsChips } from '@renderer/components/InitialsChips'
import { SkillChips } from '@renderer/components/SkillChips'
import { useRowNavigation } from '@renderer/components/useRowNavigation'
import { layoutRows } from '@shared/upcoming-groups'
import { GroupRow } from '@renderer/components/GroupRow'
import { clockNow, durationMinutes, formatDate, formatDuration } from '../shared/time'
import { formatTimeRange, initialsFor, isUpcoming } from '../shared/query'
import type { MeetingIndexRow, Person } from '../shared/types'
import { meetingRoute } from './meetings-paths'
import shared from '@renderer/components/ListTable.module.css'

/** Column widths; the summary takes the rest. */
const WIDTHS = { date: 128, time: 124, duration: 100, series: 200, skills: 190, attendees: 188 }
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
  const { ordered, groups } = layoutRows(rows, grouped, (row) => isUpcoming(row, today, clockNow()))
  const columns = showSkills ? COLUMNS.length : COLUMNS.length - 1
  const { tableProps, rowProps } = useRowNavigation(ordered.length, (index) => {
    const row = ordered[index]
    void navigate(meetingRoute(row.workspace, row.id))
  })

  return (
    <div className={shared.wrap}>
      <table className={shared.table} aria-label="Meetings" {...tableProps}>
        <colgroup>
          <col style={{ width: WIDTHS.date }} />
          <col style={{ width: WIDTHS.time }} />
          <col style={{ width: WIDTHS.duration }} />
          <col style={{ width: WIDTHS.series }} />
          <col />
          {showSkills && <col style={{ width: WIDTHS.skills }} />}
          <col style={{ width: WIDTHS.attendees }} />
        </colgroup>
        <thead>
          <tr>
            {COLUMNS.filter((label) => showSkills || label !== 'Skills').map((label) => (
              <th key={label} className={shared.th} scope="col">
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
                return (
                  <tr
                    key={`${row.workspace}/${row.id}`}
                    className={shared.row}
                    {...rowProps(index)}
                    onClick={() => void navigate(meetingRoute(row.workspace, row.id))}
                  >
                    <td className={shared.nums}>
                      <CutText>
                        <Link
                          className={shared.link}
                          tabIndex={-1}
                          to={meetingRoute(row.workspace, row.id)}
                          // The row handles the click; the link is for the keyboard and for assistive technology.
                          onClick={(event) => event.stopPropagation()}
                        >
                          {row.date ? formatDate(row.date) : 'No date'}
                        </Link>
                      </CutText>
                    </td>
                    <td className={shared.nums}>
                      <CutText>{formatTimeRange(row.start, row.end)}</CutText>
                    </td>
                    <td className={shared.nums}>
                      <CutText>{duration === null ? '—' : formatDuration(duration)}</CutText>
                    </td>
                    <td>
                      <CutText>{row.series || '—'}</CutText>
                    </td>
                    <td className={shared.secondary}>
                      {row.summary ? (
                        <CutText>{row.summary}</CutText>
                      ) : (
                        <span className={shared.missing}>No summary yet.</span>
                      )}
                    </td>
                    {showSkills && (
                      <td className={shared.skills}>
                        <SkillChips skills={row.skills} limit={1} />
                      </td>
                    )}
                    <td>
                      <InitialsChips
                        names={row.attendees}
                        initials={(name) => initialsFor(name, people)}
                      />
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
