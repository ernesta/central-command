import styles from './DocSplit.module.css'

interface DocSplitProps {
  /** The document itself: an `EditorCard`, and whatever belongs with it in the main column. */
  children: React.ReactNode
  /** The panels beside it, top to bottom (`SidePanel`s). Left out, the document has the page to itself. */
  side?: React.ReactNode
  /** The element the editor sits in, for the outline and the topics panel to scroll it. */
  docRef?: React.RefObject<HTMLDivElement | null>
  /** Two panels side by side once the screen is wide enough, rather than stacked in a narrow strip. */
  roomySide?: boolean
  /** The document fills its column instead of being capped at a comfortable line length. */
  fullWidth?: boolean
}

/**
 * The shape every page with a note has: the text on the left, its panels on the right. The side column
 * stays in view and scrolls on its own, so the panels are reachable however long the note is.
 */
export function DocSplit({
  children,
  side,
  docRef,
  roomySide = false,
  fullWidth = false
}: DocSplitProps): React.JSX.Element {
  return (
    <div
      className={[styles.split, side && styles.hasSide, roomySide && styles.roomy]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={[styles.doc, fullWidth && styles.wide].filter(Boolean).join(' ')}
        ref={docRef}
      >
        {children}
      </div>
      {side && <div className={styles.side}>{side}</div>}
    </div>
  )
}
