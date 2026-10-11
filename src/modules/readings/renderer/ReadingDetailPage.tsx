import { ArrowLeft, Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { modulePath } from '@modules/types'
import { useDocumentTitle } from '@renderer/lib/use-document-title'
import { EmptyState } from '@renderer/components/EmptyState'
import { Notice } from '@renderer/components/Notice'
import { DocSplit } from '@renderer/notes/DocSplit'
import { NoteOutline } from '@renderer/notes/NoteOutline'
import { useNotesSession } from '@renderer/notes/useNotesSession'
import { ReadingListMentions } from '@modules/reading-lists/renderer/ReadingListMentions'
import type { Reading } from '../shared/types'
import { MentionedIn } from '@renderer/entities/MentionedIn'
import { AbstractBlock } from './AbstractBlock'
import { NotesSection } from './NotesSection'
import { ReferenceBlock } from './ReferenceBlock'
import { StatusPill } from './StatusPill'
import styles from './ReadingDetailPage.module.css'

const readingsBase = modulePath({ workspace: 'research', id: 'readings' })

type Loaded = { citekey: string; reading: Reading | null }

export function ReadingDetailPage(): React.JSX.Element {
  const { citekey = '' } = useParams()
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.readings.get(citekey).then((reading) => {
      if (!cancelled) setLoaded({ citekey, reading })
    })
    return () => {
      cancelled = true
    }
  }, [citekey])

  useDocumentTitle(loaded && loaded.citekey === citekey ? loaded.reading?.shortCitation : null)

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
        {back}
        <EmptyState
          heading="Reading not found"
          message={`There is no reading with the citekey “${citekey}”.`}
        />
      </div>
    )
  }

  // Each reading gets its own notes session, disposed (saving anything pending) when you leave it.
  return <ReadingView key={reading.citekey} reading={reading} back={back} />
}

/**
 * One reading: what it is at the top, your notes in the main column, and everything *about* it —
 * the reference, your notes' outline, the lists it is in and where it is mentioned — in the side
 * column, the same arrangement as a note, a meeting and a training entry.
 */
function ReadingView({
  reading,
  back
}: {
  reading: Reading
  back: React.JSX.Element
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const docRef = useRef<HTMLDivElement>(null)
  const { session, snapshot } = useNotesSession(reading.citekey, window.api.readings.notes)

  const copyCitekey = async (): Promise<void> => {
    await navigator.clipboard.writeText(reading.citekey)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={styles.page}>
      {back}
      <header className={styles.head}>
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
      </header>

      {reading.missingFromSource && (
        <Notice>This item is no longer in your Zotero export. Your notes are safe.</Notice>
      )}

      <DocSplit
        docRef={docRef}
        side={
          <>
            <ReferenceBlock reading={reading} />
            <NoteOutline text={snapshot.text} docRef={docRef} />
            <ReadingListMentions citekey={reading.citekey} />
            <MentionedIn kind="reading" entityKey={reading.citekey} />
          </>
        }
      >
        <div className={styles.docStack}>
          {reading.abstract && <AbstractBlock abstract={reading.abstract} />}
          <NotesSection session={session} snapshot={snapshot} />
        </div>
      </DocSplit>
    </div>
  )
}
