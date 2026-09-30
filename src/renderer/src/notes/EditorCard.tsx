import { useMemo } from 'react'
import { isoDate } from '@shared/dates'
import { formatDate } from '@shared/time'
import { wordCount, wordCountLabel } from '@shared/words'
import type { SaveState } from './notes-session'
import { saveStatusText } from './save-status'
import { FindContext } from './FindContext'
import { useNotesFind } from './useNotesFind'
import styles from './EditorCard.module.css'

interface EditorCardProps {
  /** The editor (and anything that belongs inside the window with it). Its Cmd-F reaches the bar this card shows in its own footer (`FindContext`). */
  children: React.ReactNode
  /** The text as it stands now, for the word count. */
  text: string
  /** When the file was last changed (milliseconds); null when not known yet. */
  edited: number | null
  /** Where saving stands; shown first on the line ("Saved · Edited …"). Leave out for a card that never saves. */
  save?: SaveState
  /** True after the note was refreshed from disk because another tool changed it. */
  reloaded?: boolean
  /** Whether the note has any text yet; with none, "Saved" is not shown. */
  hasContent?: boolean
}

/**
 * The window every notes editor sits in: a white page with a quiet line with the save status, the date it was last edited and the word count under
 * it. Find (Cmd-F) takes over that line while it is open, since the sticky footer is where it reads as part
 * of the document's own chrome rather than a floating dialog.
 */
export function EditorCard({
  children,
  text,
  edited,
  save,
  reloaded = false,
  hasContent = true
}: EditorCardProps): React.JSX.Element {
  const find = useNotesFind()
  const words = useMemo(() => wordCount(text), [text])
  const status = save ? saveStatusText(save, reloaded, hasContent) : ''
  const parts = [
    edited === null ? null : `Edited ${formatDate(isoDate(edited))}`,
    wordCountLabel(words)
  ].filter((part): part is string => part !== null)

  return (
    <div className={styles.card}>
      <FindContext.Provider value={find.bridge}>
        <div className={styles.body}>{children}</div>
      </FindContext.Provider>
      <div className={styles.footer}>
        {find.open ? (
          find.bar
        ) : (
          <p className={styles.factsLine}>
            {status && (
              <>
                <span className={save === 'error' ? styles.statusError : undefined} role="status">
                  {status}
                </span>
                {' · '}
              </>
            )}
            {parts.join(' · ')}
          </p>
        )}
      </div>
    </div>
  )
}
