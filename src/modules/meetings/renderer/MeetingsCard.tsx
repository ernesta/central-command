import { Link } from 'react-router'
import { modulePath } from '@modules/types'
import styles from './MeetingsCard.module.css'

/** A minimal Meetings entry on the Research landing page; replaced by the live card with the landing page. */
export function MeetingsCard(): React.JSX.Element {
  return (
    <div className={styles.card}>
      <h2 className={styles.title}>
        <Link className={styles.link} to={modulePath({ workspace: 'research', id: 'meetings' })}>
          Meetings
        </Link>
      </h2>
      <p className={styles.line}>Notes for every meeting, with TODOs carried over</p>
    </div>
  )
}
