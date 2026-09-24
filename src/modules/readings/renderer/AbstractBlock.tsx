import { useId, useState } from 'react'
import styles from './AbstractBlock.module.css'

/** Roughly six lines at the reading column's width; longer abstracts start collapsed. */
const COLLAPSE_ABOVE = 520

/** The abstract as synced from Zotero (read-only). Long ones collapse behind a toggle. */
export function AbstractBlock({ abstract }: { abstract: string }): React.JSX.Element {
  const collapsible = abstract.length > COLLAPSE_ABOVE
  const [expanded, setExpanded] = useState(false)
  const textId = useId()

  return (
    <section className={styles.block} aria-label="Abstract">
      <h2 className={styles.label}>Abstract — synced from Zotero</h2>
      <p
        id={textId}
        className={[styles.text, collapsible && !expanded && styles.clamped]
          .filter(Boolean)
          .join(' ')}
      >
        {abstract}
      </p>
      {collapsible && (
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          aria-controls={textId}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </section>
  )
}
