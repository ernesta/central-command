import { Pin } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useRowNavigation } from '@renderer/components/useRowNavigation'
import { formatDate } from '@shared/time'
import { isoDate } from '../shared/dates'
import { groupLabel } from '../shared/groups'
import { displayTitle } from '../shared/query'
import type { NoteIndexRow } from '../shared/types'
import { noteRoute } from './notes-paths'
import styles from './NotesTable.module.css'

const PREVIEW_LENGTH = 140

/** The start of a note's text, cut at a word. */
function preview(excerpt: string): string {
  if (excerpt.length <= PREVIEW_LENGTH) return excerpt
  return `${excerpt.slice(0, PREVIEW_LENGTH).replace(/\s+\S*$/, '')}…`
}

/**
 * Title, group, the start of the text and when it was last edited. Clicking anywhere on a row opens the note.
 * Like the Meetings table it is one tab stop: arrow keys, Home/End and PageUp/PageDown move between rows and
 * Enter opens the note.
 */
export function NotesTable({ rows }: { rows: NoteIndexRow[] }): React.JSX.Element {
  const navigate = useNavigate()
  const { tableProps, rowProps } = useRowNavigation(
    rows.length,
    (index) => void navigate(noteRoute(rows[index].id))
  )

  return (
    <div className={styles.wrap}>
      <table className={styles.table} aria-label="Notes" {...tableProps}>
        <thead>
          <tr>
            {['Title', 'Group', 'Text', 'Edited'].map((label) => (
              <th key={label} className={styles.th} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const group = groupLabel(row.group, row.subgroup)
            return (
              <tr
                key={`${row.workspace}/${row.id}`}
                className={styles.row}
                {...rowProps(index)}
                onClick={() => void navigate(noteRoute(row.id))}
              >
                <td className={styles.titleCell}>
                  {row.pinned && (
                    <Pin
                      size={13}
                      strokeWidth={1.75}
                      fill="currentColor"
                      className={styles.pin}
                      aria-label="Pinned"
                    />
                  )}
                  <Link
                    className={styles.link}
                    tabIndex={-1}
                    to={noteRoute(row.id)}
                    // The row handles the click; the link is for the keyboard and for assistive technology.
                    onClick={(event) => event.stopPropagation()}
                  >
                    {displayTitle(row)}
                  </Link>
                </td>
                <td className={styles.nowrap}>
                  {group ? group : <span className={styles.none}>Ungrouped</span>}
                </td>
                <td className={styles.preview}>{preview(row.excerpt)}</td>
                <td className={styles.nowrap}>{formatDate(isoDate(row.edited))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
