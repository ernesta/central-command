import { Link } from 'react-router'
import { modulePath } from '@modules/types'
import { deriveGroups } from '../shared/groups'
import { displayTitle, noteCount, recentNotes } from '../shared/query'
import { useNotesList } from './useNotesList'
import styles from './NotesCard.module.css'

/** The Notes entry on the Research landing page: how many notes and groups, and the latest note. */
export function NotesCard(): React.JSX.Element {
  const rows = useNotesList()
  const latest = rows ? recentNotes(rows, 1)[0] : undefined
  const groups = rows ? deriveGroups(rows).length : 0

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>
        <Link className={styles.link} to={modulePath({ workspace: 'research', id: 'notes' })}>
          Notes
        </Link>
      </h2>
      {rows === null ? null : rows.length === 0 ? (
        <p className={styles.line}>No notes yet</p>
      ) : (
        <>
          <p className={styles.line}>
            {noteCount(rows.length)} · {groups} {groups === 1 ? 'group' : 'groups'}
          </p>
          {latest && <p className={styles.line}>Latest: {displayTitle(latest)}</p>}
        </>
      )}
    </div>
  )
}
