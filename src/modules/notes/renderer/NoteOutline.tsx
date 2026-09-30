import { headingStart, liveViewIn, scrollToPos } from '@renderer/editor/live-outline'
import { locatedOutline, type LocatedOutlineItem } from '@shared/markdown-outline'
import styles from './NoteOutline.module.css'

/** Levels shown: a note's own top-level structure, not every sub-sub-heading. */
const LEVELS = [1, 2, 3]

/**
 * Take the editor to the outline entry's heading. The live editor is sent to the heading's line; Milkdown's page is
 * searched for the first heading of that level with that text.
 */
function scrollToHeading(root: HTMLElement | null, item: LocatedOutlineItem): void {
  const live = liveViewIn(root)
  if (live) {
    const pos = headingStart(live.state, item.line)
    if (pos !== null) scrollToPos(live, pos)
    return
  }
  const heading = Array.from(
    root?.querySelectorAll<HTMLElement>(`.ProseMirror h${item.level}`) ?? []
  ).find((h) => (h.textContent ?? '').replace(/\s+/g, ' ').trim() === item.text)
  heading?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * The note's own headings (`#` to `###`), generated from its text and kept live as you type: click one to jump
 * to it. Empty until the note has a heading. `docRef` is the element the editor is inside.
 */
export function NoteOutline({
  text,
  docRef
}: {
  text: string
  docRef: React.RefObject<HTMLElement | null>
}): React.JSX.Element {
  const outline = locatedOutline(text, LEVELS)
  return (
    <nav className={styles.panel} aria-label="Outline">
      <h2 className={styles.label}>Outline</h2>
      {outline.length === 0 ? (
        <p className={styles.empty}>Headings you write appear here.</p>
      ) : (
        <ul className={styles.list}>
          {outline.map((item, i) => (
            <li key={`${i}-${item.text}`}>
              <button
                type="button"
                className={[
                  styles.item,
                  item.level === 2 && styles.level2,
                  item.level === 3 && styles.level3
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => scrollToHeading(docRef.current, item)}
              >
                {item.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  )
}
