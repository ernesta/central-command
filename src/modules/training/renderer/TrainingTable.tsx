import { FileText, Folder } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { Person } from '@shared/people'
import { durationMinutes, formatDate, formatDuration } from '@shared/time'
import { formatTimeRange, initialsFor } from '@modules/meetings/shared/query'
import { isUpcoming } from '../shared/rules'
import type { TrainingIndexRow } from '../shared/types'
import { entryRoute } from './training-paths'
import styles from './TrainingTable.module.css'

const VISIBLE_LEADS = 3

/**
 * Date, Time, Duration, Series, Type, Title and summary, Skills, Leads. Clicking anywhere on a row opens
 * the entry. Like the Meetings table, it is one tab stop: arrow keys, Home/End and PageUp/PageDown move
 * between rows and Enter opens the entry.
 */
export function TrainingTable({
  rows,
  people,
  today
}: {
  rows: TrainingIndexRow[]
  people: Person[]
  today: string
}): React.JSX.Element {
  const navigate = useNavigate()
  const [active, setActive] = useState(0)
  const rowEls = useRef<(HTMLTableRowElement | null)[]>([])
  // Keep the tab stop valid when the list shrinks (search, filters).
  const activeIndex = Math.min(active, Math.max(rows.length - 1, 0))

  const move = (next: number): void => {
    const clamped = Math.max(0, Math.min(rows.length - 1, next))
    setActive(clamped)
    rowEls.current[clamped]?.focus()
  }
  const onKeyDown = (event: React.KeyboardEvent, row: TrainingIndexRow, index: number): void => {
    const page = 8
    const keys: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      PageDown: index + page,
      PageUp: index - page,
      Home: 0,
      End: rows.length - 1
    }
    if (event.key in keys) {
      event.preventDefault()
      move(keys[event.key])
    } else if (event.key === 'Enter') {
      event.preventDefault()
      void navigate(entryRoute(row.id))
    }
  }

  return (
    <div className={styles.wrap}>
      <table
        className={styles.table}
        aria-label="Training"
        // Tabbing out of the table resets the tab stop to the first row, so coming back does not land mid-list.
        onBlur={(event) => {
          const next = event.relatedTarget
          if (next instanceof Node && !event.currentTarget.contains(next)) setActive(0)
        }}
      >
        <thead>
          <tr>
            {[
              'Date',
              'Time',
              'Duration',
              'Series',
              'Type',
              'Title and summary',
              'Skills',
              'Leads'
            ].map((label) => (
              <th key={label} className={styles.th} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const duration = durationMinutes(row.start, row.end)
            const shown = row.leads.slice(0, VISIBLE_LEADS)
            const more = row.leads.length - shown.length
            return (
              <tr
                key={`${row.workspace}/${row.id}`}
                ref={(el) => {
                  rowEls.current[index] = el
                }}
                tabIndex={index === activeIndex ? 0 : -1}
                className={styles.row}
                onFocus={() => setActive(index)}
                onKeyDown={(event) => onKeyDown(event, row, index)}
                onClick={() => void navigate(entryRoute(row.id))}
              >
                <td className={styles.nowrap}>
                  <Link
                    className={styles.link}
                    tabIndex={-1}
                    to={entryRoute(row.id)}
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
                <td className={styles.nowrap}>
                  {row.type || <span className={styles.missing}>No type</span>}
                </td>
                <td className={styles.titleCell}>
                  <span className={styles.titleText}>{row.title || 'Untitled'}</span>
                  <span className={styles.marks}>
                    {row.hasNotes && (
                      <FileText size={13} strokeWidth={1.75} aria-label="Has notes" />
                    )}
                    {row.folder && (
                      <Folder size={13} strokeWidth={1.75} aria-label="Has a linked folder" />
                    )}
                  </span>
                  {row.summary && <span className={styles.summaryText}>{row.summary}</span>}
                </td>
                <td className={styles.skills}>
                  {row.skills.length === 0 ? (
                    '—'
                  ) : (
                    <ul className={styles.skillList}>
                      {row.skills.map((skill) => (
                        <li key={skill}>{skill}</li>
                      ))}
                    </ul>
                  )}
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
