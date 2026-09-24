import { ArrowLeft, Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { modulePath } from '@modules/types'
import { EmptyState } from '@renderer/components/EmptyState'
import { Notice } from '@renderer/components/Notice'
import type { Reading } from '../shared/types'
import { StatusPill } from './StatusPill'
import styles from './ReadingDetailPage.module.css'

const readingsBase = modulePath({ workspace: 'research', id: 'readings' })

type Loaded = { citekey: string; reading: Reading | null }

export function ReadingDetailPage(): React.JSX.Element {
  const { citekey = '' } = useParams()
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    void window.api.readings.get(citekey).then((reading) => {
      if (!cancelled) setLoaded({ citekey, reading })
    })
    return () => {
      cancelled = true
    }
  }, [citekey])

  const backToList = (): void => {
    void navigate(readingsBase)
  }
  const back = (
    <button type="button" className={styles.back} onClick={backToList}>
      <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
      Readings
    </button>
  )

  // Wait for the reading that matches the URL (not a stale one from the previous page).
  if (!loaded || loaded.citekey !== citekey) return <div className={styles.page} />
  const { reading } = loaded
  if (!reading) {
    return (
      <div className={styles.page}>
        <div className={styles.column}>{back}</div>
        <EmptyState
          heading="Reading not found"
          message={`There is no reading with the citekey “${citekey}”.`}
        />
      </div>
    )
  }

  const copyCitekey = async (): Promise<void> => {
    await navigator.clipboard.writeText(reading.citekey)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={styles.page}>
      <article className={styles.column}>
        {back}
        <div className={styles.citekeyRow}>
          <span className={styles.citekey}>{reading.citekey}</span>
          <button
            type="button"
            className={styles.copy}
            aria-label={copied ? 'Copied' : 'Copy citekey'}
            title={copied ? 'Copied' : 'Copy citekey'}
            onClick={() => void copyCitekey()}
          >
            {copied ? (
              <Check size={14} strokeWidth={1.75} />
            ) : (
              <Copy size={14} strokeWidth={1.75} />
            )}
          </button>
        </div>
        <h1 className={styles.title}>{reading.fullTitle}</h1>
        <div className={styles.meta}>
          <span className={styles.citation}>{reading.shortCitation}</span>
          <StatusPill status={reading.status} />
          {reading.tags.length > 0 && (
            <span className={styles.tags}>{reading.tags.join(', ')}</span>
          )}
        </div>
        {reading.missingFromSource && (
          <div className={styles.missing}>
            <Notice>This item is no longer in your Zotero export. Your notes are safe.</Notice>
          </div>
        )}
      </article>
    </div>
  )
}
