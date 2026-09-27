import { Link, useNavigate } from 'react-router'
import { useRowNavigation } from '@renderer/components/useRowNavigation'
import { isoDate } from '@shared/dates'
import { formatDate } from '@shared/time'
import type { ReadingListIndexRow } from '@modules/reading-lists/shared/types'
import { readingListRoute } from './reading-lists-paths'
import styles from './ReadingListsTable.module.css'

/**
 * Title, sections, entries and when it was last edited. Clicking anywhere on a row opens the list.
 * Like the Notes and Meetings tables it is one tab stop: arrow keys, Home/End and PageUp/PageDown move
 * between rows and Enter opens the row.
 */
export function ReadingListsTable({ rows }: { rows: ReadingListIndexRow[] }): React.JSX.Element {
  const navigate = useNavigate()
  const { tableProps, rowProps } = useRowNavigation(
    rows.length,
    (index) => void navigate(readingListRoute(rows[index].id))
  )

  return (
    <div className={styles.wrap}>
      <table className={styles.table} aria-label="Reading lists" {...tableProps}>
        <thead>
          <tr>
            {['Title', 'Sections', 'Entries', 'Edited'].map((label) => (
              <th key={label} className={styles.th} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.workspace}/${row.id}`}
              className={styles.row}
              {...rowProps(index)}
              onClick={() => void navigate(readingListRoute(row.id))}
            >
              <td className={styles.titleCell}>
                <Link
                  className={styles.link}
                  tabIndex={-1}
                  to={readingListRoute(row.id)}
                  onClick={(event) => event.stopPropagation()}
                >
                  {row.title || 'Untitled list'}
                </Link>
              </td>
              <td className={styles.nowrap}>
                {row.sectionCount === 0 ? (
                  <span className={styles.none}>None yet</span>
                ) : (
                  row.sectionCount
                )}
              </td>
              <td className={styles.nowrap}>{row.entryCount}</td>
              <td className={styles.nowrap}>{formatDate(isoDate(row.edited))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
