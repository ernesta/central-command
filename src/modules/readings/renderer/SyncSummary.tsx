import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@renderer/components/Button'
import { formatRelativeTime } from '@renderer/lib/relative-time'
import { useSettings } from '@renderer/state/settings-context'
import type { ReadingCounts, SyncRun } from '../shared/types'
import { useSyncStatus } from './useSyncStatus'
import styles from './SyncSummary.module.css'

function countsLine(counts: ReadingCounts): string {
  const parts = [`${counts.total} readings`, `${counts.toRead} to read`, `${counts.read} read`]
  if (counts.unset > 0) parts.push(`${counts.unset} unset`)
  return parts.join(' · ')
}

function runLine(run: SyncRun): string {
  const parts = [`${run.inserted} new`, `${run.updated} updated`]
  if (run.flaggedMissing > 0) parts.push(`${run.flaggedMissing} no longer in Zotero`)
  return `Last run: ${parts.join(', ')}`
}

/** Re-renders periodically so "2 min ago" stays true. */
function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function SyncSummary(): React.JSX.Element {
  const { settings } = useSettings()
  const { status, counts, syncNow } = useSyncStatus()
  const now = useNow()
  const syncing = status?.state === 'syncing'

  let dot = styles.dot
  let headline = 'Checking…'
  if (status) {
    switch (status.state) {
      case 'syncing':
        dot = `${styles.dot} ${styles.syncing}`
        headline = 'Syncing…'
        break
      case 'error':
        dot = `${styles.dot} ${styles.error}`
        headline = 'Sync failed'
        break
      case 'idle':
        dot = `${styles.dot} ${styles.ok}`
        headline = status.lastSuccessAt
          ? `Last synced ${formatRelativeTime(status.lastSuccessAt, now)}`
          : 'Synced'
        break
      case 'not_configured':
        headline = 'Not connected to Zotero yet'
        break
    }
  }

  return (
    <section className={styles.card} aria-label="Zotero sync">
      <div className={styles.header}>
        <h2 className={styles.title}>Zotero sync</h2>
        <Button
          size="small"
          icon={<RefreshCw size={14} strokeWidth={1.75} aria-hidden />}
          disabled={syncing}
          onClick={() => void syncNow()}
        >
          Sync now
        </Button>
      </div>

      <div className={styles.statusRow}>
        <span className={dot} aria-hidden />
        <span>{headline}</span>
      </div>

      {status?.state === 'error' && (
        <>
          <p className={styles.errorText} role="alert">
            {status.message}
          </p>
          <p className={styles.muted}>Your readings and notes are unchanged.</p>
        </>
      )}

      {status?.state === 'not_configured' && (
        <p className={styles.muted}>
          Export your library from Zotero with Better BibTeX (tick “Keep updated”) to{' '}
          <span className={styles.path}>{settings.zoteroExportPath}</span>. Syncing starts
          automatically once the file exists.
        </p>
      )}

      {counts && counts.total > 0 && <p className={styles.counts}>{countsLine(counts)}</p>}
      {counts && counts.missingFromSource > 0 && (
        <p className={styles.muted}>
          {counts.missingFromSource} no longer in your Zotero export. Notes are kept.
        </p>
      )}
      {status?.state === 'idle' && status.lastRun?.status === 'ok' && (
        <p className={styles.muted}>{runLine(status.lastRun)}</p>
      )}
    </section>
  )
}
