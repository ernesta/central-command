import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { ReadingListMention } from '@modules/reading-lists/shared/api'
import { readingListRoute } from './reading-lists-paths'
import styles from './ReadingListMentions.module.css'

/**
 * The reading lists that mention this reading, each with that list's own short annotation (not the
 * rest of the list, and not the reading's own, often much longer, notes). Nothing is shown while
 * there are none, so a reading that is in no list looks exactly as it did before this existed.
 */
export function ReadingListMentions({ citekey }: { citekey: string }): React.JSX.Element | null {
  const [mentions, setMentions] = useState<ReadingListMention[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.readingLists.forReading(citekey).then((result) => {
      if (!cancelled) setMentions(result)
    })
    return () => {
      cancelled = true
    }
  }, [citekey])

  if (!mentions || mentions.length === 0) return null

  return (
    <div className={styles.section} aria-label="In your reading lists">
      <p className={styles.label}>In your reading lists</p>
      <ul className={styles.list}>
        {mentions.map((m) => (
          <li key={`${m.ref.id}-${m.section}`} className={styles.row}>
            <Link className={styles.link} to={readingListRoute(m.ref.id)}>
              {m.listTitle}
              {m.section && <span className={styles.sectionName}> · {m.section}</span>}
            </Link>
            {m.annotation && <p className={styles.annotation}>{m.annotation}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
