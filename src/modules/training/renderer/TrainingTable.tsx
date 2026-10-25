import { Fragment } from 'react'
import { FileText, Folder } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { SkillChips } from '@renderer/components/SkillChips'
import { useRowNavigation } from '@renderer/components/useRowNavigation'
import type { Person } from '@shared/people'
import { formatDate } from '@shared/time'
import { layoutRows } from '@shared/upcoming-groups'
import { GroupRow } from '@renderer/components/GroupRow'
import { Tooltip } from '@renderer/components/Tooltip'
import { durationWithStudy } from '../shared/row-time'
import { formatTimeRange, initialsFor } from '@modules/meetings/shared/query'
import { entryParts, isUpcoming, type SelfStudy } from '../shared/rules'
import type { TrainingIndexRow, TrainingWorkspace } from '../shared/types'
import { entryRoute } from './training-paths'
import styles from './TrainingTable.module.css'

const VISIBLE_LEADS = 3

/**
 * Date, Time, Duration, Series, Title, Skills, Leads. Clicking anywhere on a row opens
 * the entry. Like the Notes table, it is one tab stop: arrow keys, Home/End and PageUp/PageDown move
 * between rows and Enter opens the entry.
 */
export function TrainingTable({
  rows,
  people,
  today,
  selfStudy,
  workspace = 'research',
  grouped = true
}: {
  rows: TrainingIndexRow[]
  people: Person[]
  today: string
  /** Minutes tracked on each training's task, so a duration is the training's total. */
  selfStudy?: SelfStudy
  /** Life's log has no type or skills columns (they are Inkpath's). */
  workspace?: TrainingWorkspace
  /** Upcoming / Earlier headers: only while the list is sorted by date, newest first. */
  grouped?: boolean
}): React.JSX.Element {
  const research = workspace === 'research'
  const navigate = useNavigate()
  const { ordered, groups } = layoutRows(rows, grouped, (row) => isUpcoming(row, today))
  const columns = research ? 7 : 6
  const { tableProps, rowProps } = useRowNavigation(
    ordered.length,
    (index) => void navigate(entryRoute(ordered[index].id, workspace))
  )

  return (
    <div className={styles.wrap}>
      <table className={styles.table} aria-label="Training" {...tableProps}>
        <thead>
          <tr>
            {(research
              ? ['Date', 'Time', 'Duration', 'Series', 'Title', 'Skills', 'Leads']
              : ['Date', 'Time', 'Duration', 'Series', 'Title', 'Leads']
            ).map((label) => (
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
                const parts = entryParts(row, selfStudy)
                const shown = row.leads.slice(0, VISIBLE_LEADS)
                const more = row.leads.length - shown.length
                return (
                  <tr
                    key={`${row.workspace}/${row.id}`}
                    className={styles.row}
                    {...rowProps(index)}
                    onClick={() => void navigate(entryRoute(row.id, workspace))}
                  >
                    <td className={styles.nowrap}>
                      <Link
                        className={styles.link}
                        tabIndex={-1}
                        to={entryRoute(row.id, workspace)}
                        // The row handles the click; the link is for the keyboard and for assistive technology.
                        onClick={(event) => event.stopPropagation()}
                      >
                        {row.date ? formatDate(row.date) : 'No date'}
                      </Link>
                    </td>
                    <td className={styles.nowrap}>{formatTimeRange(row.start, row.end)}</td>
                    <td className={styles.nowrap}>
                      {parts === null ? '—' : durationWithStudy(parts.training, parts.selfStudy)}
                    </td>
                    <td className={styles.nowrap}>{row.series || '—'}</td>
                    <td className={styles.titleCell}>
                      {(row.hasNotes || row.folder) && (
                        <span className={styles.marks}>
                          {row.folder && (
                            <Folder size={13} strokeWidth={1.75} aria-label="Has a linked folder" />
                          )}
                          {row.hasNotes && (
                            <FileText size={13} strokeWidth={1.75} aria-label="Has notes" />
                          )}
                        </span>
                      )}
                      <span className={styles.titleText}>{row.title || 'Untitled'}</span>
                    </td>
                    {research && (
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
