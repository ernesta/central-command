import { Link } from 'react-router'
import { modulePath } from '@modules/types'
import { useReadingListsList } from './useReadingListsList'
import styles from './ReadingListsCard.module.css'

/** The Reading lists entry on the Research landing page: how many lists there are. */
export function ReadingListsCard(): React.JSX.Element {
  const rows = useReadingListsList()

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>
        <Link
          className={styles.link}
          to={modulePath({ workspace: 'research', id: 'reading-lists' })}
        >
          Reading lists
        </Link>
      </h2>
      {rows === null ? null : rows.length === 0 ? (
        <p className={styles.line}>No lists yet</p>
      ) : (
        <p className={styles.line}>
          {rows.length} {rows.length === 1 ? 'list' : 'lists'}
        </p>
      )}
    </div>
  )
}
