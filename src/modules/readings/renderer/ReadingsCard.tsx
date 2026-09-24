import { useNavigate } from 'react-router'
import { modulePath } from '@modules/types'
import { Button } from '@renderer/components/Button'
import { formatRelativeTime } from '@renderer/lib/relative-time'
import { useSyncStatus } from './useSyncStatus'
import styles from './ReadingsCard.module.css'

/** The Readings entry on the Research landing page. Click anywhere (except the button) to open Readings. */
export function ReadingsCard(): React.JSX.Element {
  const navigate = useNavigate()
  const { status, counts } = useSyncStatus()
  const connected = status?.lastSuccessAt != null
  const openReadings = (): void => {
    void navigate(modulePath({ workspace: 'research', id: 'readings' }))
  }

  return (
    <div
      className={styles.card}
      role="link"
      tabIndex={0}
      aria-label="Readings"
      onClick={openReadings}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          openReadings()
        }
      }}
    >
      <h2 className={styles.title}>Readings</h2>
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
            onClick={(event) => {
              event.stopPropagation()
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
