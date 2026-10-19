import { FileText, Folder } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { SkillChips } from '@renderer/components/SkillChips'
import { useRowNavigation } from '@renderer/components/useRowNavigation'
import type { Person } from '@shared/people'
import { formatDate } from '@shared/time'
import { durationWithStudy } from '../shared/row-time'
import { formatTimeRange, initialsFor } from '@modules/meetings/shared/query'
import { entryParts, isUpcoming, type SelfStudy } from '../shared/rules'
import {
  TRAINING_MODE_LABELS,
  typeLabel,
  type TrainingIndexRow,
  type TrainingWorkspace
} from '../shared/types'
import { entryRoute } from './training-paths'
import styles from './TrainingTable.module.css'

const VISIBLE_LEADS = 3

/**
 * Date, Time, Duration, Format, Type, Series, Title and summary, Skills, Leads. Clicking anywhere on a row opens
 * the entry. Like the Notes table, it is one tab stop: arrow keys, Home/End and PageUp/PageDown move
 * between rows and Enter opens the entry.
 */
export function TrainingTable({
  rows,
  people,
  today,
  selfStudy,
  workspace = 'research'
}: {
  rows: TrainingIndexRow[]
  people: Person[]
  today: string
  /** Minutes tracked on each training's task, so a duration is the training's total. */
  selfStudy?: SelfStudy
  /** Life's log has no type or skills columns (they are Inkpath's). */
  workspace?: TrainingWorkspace
}): React.JSX.Element {
  const research = workspace === 'research'
  const navigate = useNavigate()
  const { tableProps, rowProps } = useRowNavigation(
    rows.length,
    (index) => void navigate(entryRoute(rows[index].id, workspace))
  )

  return (
    <div className={styles.wrap}>
      <table className={styles.table} aria-label="Training" {...tableProps}>
        <thead>
          <tr>
            {(research
              ? [
                  'Date',
                  'Time',
                  'Duration',
                  'Format',
                  'Type',
                  'Series',
                  'Title and summary',
                  'Skills',
                  'Leads'
                ]
              : ['Date', 'Time', 'Duration', 'Format', 'Series', 'Title and summary', 'Leads']
            ).map((label) => (
              <th key={label} className={styles.th} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
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
                    {row.date ? formatDate(row.date) : 'No date yet'}
                  </Link>
                  {isUpcoming(row, today) && (
                    <span className={styles.upcoming}>{row.date ? 'Upcoming' : 'Planned'}</span>
                  )}
                </td>
                <td className={styles.nowrap}>{formatTimeRange(row.start, row.end)}</td>
                <td className={styles.nowrap}>
                  {parts === null ? '—' : durationWithStudy(parts.training, parts.selfStudy)}
                </td>
                <td className={styles.nowrap}>{row.mode ? TRAINING_MODE_LABELS[row.mode] : '—'}</td>
                {research && (
                  <td className={styles.nowrap}>
                    {row.type ? (
                      typeLabel(row.type)
                    ) : (
                      <span className={styles.noType}>No type yet</span>
                    )}
                  </td>
                )}
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
                  {row.summary && <span className={styles.summaryText}>{row.summary}</span>}
                </td>
                {research && (
                  <td className={styles.skills}>
                    <SkillChips skills={row.skills} stacked />
                  </td>
                )}
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
