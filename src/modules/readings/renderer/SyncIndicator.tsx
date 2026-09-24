import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { formatRelativeTime } from '@renderer/lib/relative-time'
import type { SyncStatus } from '../shared/types'
import styles from './SyncIndicator.module.css'

interface SyncIndicatorProps {
  status: SyncStatus | null
  onSync: () => void
}

function describe(status: SyncStatus | null): string {
  if (!status) return 'Checking sync status'
  switch (status.state) {
    case 'syncing':
      return 'Syncing…'
    case 'error':
      return `Sync failed: ${status.message ?? 'unknown error'}`
    case 'not_configured':
      return 'Not connected to Zotero yet'
    case 'idle':
      return status.lastSuccessAt
        ? `Last synced ${formatRelativeTime(status.lastSuccessAt)}`
        : 'Synced'
  }
}

/** A status dot (ok / syncing / error) next to a "Sync now" button. Errors show their message on hover or click. */
export function SyncIndicator({ status, onSync }: SyncIndicatorProps): React.JSX.Element {
  const [showError, setShowError] = useState(false)
  const state = status?.state
  const isError = state === 'error'
  const dotClass = [
    styles.dot,
    state === 'idle' && styles.ok,
    state === 'syncing' && styles.syncing,
    isError && styles.error
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.dotButton}
        title={describe(status)}
        aria-label={describe(status)}
        aria-expanded={isError ? showError : undefined}
        disabled={!isError}
        onClick={() => setShowError((s) => !s)}
      >
        <span className={dotClass} />
      </button>
      <Button
        size="small"
        icon={<RefreshCw size={14} strokeWidth={1.75} aria-hidden />}
        disabled={state === 'syncing'}
        onClick={() => {
          setShowError(false)
          onSync()
        }}
      >
        Sync now
      </Button>
      {isError && showError && (
        <div className={styles.message} role="alert">
          {status?.message}
          <br />
          Your readings and notes are unchanged.
        </div>
      )}
    </div>
  )
}
