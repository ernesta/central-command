import { useMemo } from 'react'
import { isoDate } from '@shared/dates'
import { formatDate } from '@shared/time'
import { wordCount, wordCountLabel } from '@shared/words'
import styles from './EditorCard.module.css'

interface EditorCardProps {
  /** The editor (and anything that belongs inside the window with it). */
  children: React.ReactNode
  /** The text as it stands now, for the word count. */
  text: string
  /** When the note was made, as `YYYY-MM-DD`, for kinds of note that record it. */
  created?: string
  /** When the file was last changed (milliseconds); null when not known yet. */
  edited: number | null
}

/** The window every notes editor sits in: a white page with a quiet line of dates and the word count under it. */
export function EditorCard({
  children,
  text,
  created,
  edited
}: EditorCardProps): React.JSX.Element {
  const words = useMemo(() => wordCount(text), [text])
  const parts = [
    created ? `Created ${formatDate(created)}` : null,
    edited === null ? null : `Edited ${formatDate(isoDate(edited))}`,
    wordCountLabel(words)
  ].filter((part): part is string => part !== null)

  return (
    <div className={styles.card}>
      <div className={styles.body}>{children}</div>
      <p className={styles.footer}>{parts.join(' · ')}</p>
    </div>
  )
}
