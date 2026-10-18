import { useEffect, useState } from 'react'
import { Panel } from '@renderer/components/Panel'
import { headingStart, liveViewIn, scrollToPos } from '@renderer/editor/live-outline'
import { locatedOutline, type LocatedOutlineItem } from '@shared/markdown-outline'
import styles from './NoteOutline.module.css'

/** Levels shown: a note's own top-level structure, not every sub-sub-heading. */
const LEVELS = [1, 2, 3]

/** Take the editor to the outline entry's heading: the editor is sent to the heading's line (it draws only the lines near the screen). */
function scrollToHeading(root: HTMLElement | null, item: LocatedOutlineItem): void {
  const live = liveViewIn(root)
  if (!live) return
  const pos = headingStart(live.state, item.line)
  if (pos !== null) scrollToPos(live, pos)
}

/** How far below the top of the window a heading counts as the one being read (clear of the top bar). */
const READING_LINE = 120

/** The outline entry being read: the last heading at or above the reading line, or null before the first. */
function currentIndex(root: HTMLElement | null, outline: LocatedOutlineItem[]): number | null {
  const live = liveViewIn(root)
  if (!live) return null
  const line = READING_LINE - live.documentTop
  let found: number | null = null
  for (const [i, item] of outline.entries()) {
    const pos = headingStart(live.state, item.line)
    if (pos === null) continue
    if (live.lineBlockAt(pos).top > line) break
    found = i
  }
  return found
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
  const [current, setCurrent] = useState<number | null>(null)
  const signature = outline.map((item) => `${item.line}:${item.text}`).join('\n')
  useEffect(() => {
    let frame = 0
    const update = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setCurrent(currentIndex(docRef.current, outline)))
    }
    update()
    window.addEventListener('scroll', update, { capture: true, passive: true })
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', update, { capture: true })
      window.removeEventListener('resize', update)
    }
    // `outline` is rebuilt every render; `signature` says when it really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, docRef])
  return (
    <Panel as="nav" label="Outline">
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
                  item.level === 3 && styles.level3,
                  i === current && styles.current
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={i === current ? 'location' : undefined}
                onClick={() => scrollToHeading(docRef.current, item)}
              >
                {item.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
