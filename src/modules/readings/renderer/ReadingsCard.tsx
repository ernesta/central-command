import { Link, useNavigate } from 'react-router'
import { modulePath } from '@modules/types'
import { Button } from '@renderer/components/Button'
import { formatRelativeTime } from '@renderer/lib/relative-time'
import { useSyncStatus } from './useSyncStatus'
import styles from './ReadingsCard.module.css'

/** The Readings entry on the Research landing page. The title is a real link whose hit area covers the whole card. */
export function ReadingsCard(): React.JSX.Element {
  const navigate = useNavigate()
  const { status, counts } = useSyncStatus()
  const connected = status?.lastSuccessAt != null

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>
        <Link className={styles.link} to={modulePath({ workspace: 'research', id: 'readings' })}>
          Readings
        </Link>
      </h2>
      {status === null ? null : connected && counts ? (
        <>
          <p className={styles.line}>
            {counts.total} readings · {counts.toRead} to read
          </p>
          <p className={styles.line}>
            Last synced {formatRelativeTime(status.lastSuccessAt as string)}
          </p>
          {status.state === 'error' && (
            <p className={`${styles.line} ${styles.error}`}>
              The last sync failed. Your data is unchanged.
            </p>
          )}
        </>
      ) : (
        <>
          <p className={styles.line}>Not connected to Zotero yet</p>
          <Button
            variant="primary"
            className={styles.action}
            onClick={() => {
              void navigate('/settings')
            }}
          >
            Set up Zotero sync
          </Button>
        </>
      )}
    </div>
  )
}
