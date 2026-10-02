import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { PickerSnapshot } from './picker-controller'
import styles from './EntityPicker.module.css'

interface EntityPickerProps {
  snapshot: PickerSnapshot
  onChoose: (index: number) => void
  onHover: (index: number) => void
}

const EDGE = 12
const WIDTH = 360
const MAX_HEIGHT = 360

/**
 * The list that opens under the cursor when `@` is typed: people, readings, meetings and notes matching what follows
 * it, grouped by kind. The editor keeps the keyboard (arrows, Enter, Tab and Escape are handled by
 * `EntityPickerController`); a click picks without taking focus away from the text.
 */
export function EntityPicker({
  snapshot,
  onChoose,
  onHover
}: EntityPickerProps): React.JSX.Element | null {
  const activeRef = useRef<HTMLDivElement>(null)
  const pointer = useRef({ x: -1, y: -1 })

  // Keep the row the arrows are on in view.
  useLayoutEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  })

  if (!snapshot.open) return null
  // The list opens on the side with room and stays there: where it sits depends only on where the `@` is, never on how many rows came back.
  const below = window.innerHeight - snapshot.top - EDGE
  const above = snapshot.lineTop - 6 - EDGE
  const opensAbove = below < MAX_HEIGHT && above > below
  const left = Math.max(EDGE, Math.min(snapshot.left, window.innerWidth - WIDTH - EDGE))
  const place: React.CSSProperties = opensAbove
    ? {
        left,
        bottom: window.innerHeight - snapshot.lineTop + 6,
        maxHeight: Math.min(MAX_HEIGHT, above)
      }
    : { left, top: snapshot.top, maxHeight: Math.min(MAX_HEIGHT, below) }
  let index = -1
  return createPortal(
    <div
      className={styles.menu}
      style={place}
      role="listbox"
      aria-label="Link to"
      // Clicking must not take the cursor out of the note.
      onMouseDown={(event) => event.preventDefault()}
    >
      {snapshot.query.trim() === '' ? (
        <p className={styles.note}>Type to find a person, reading, meeting or note.</p>
      ) : snapshot.groups.length === 0 ? (
        <p className={styles.note}>{snapshot.loading ? 'Searching…' : 'Nothing found.'}</p>
      ) : (
        snapshot.groups.map(({ provider, hits }) => {
          const Icon = provider.icon
          return (
            <div key={provider.kind} role="group" aria-label={provider.heading}>
              <h3 className={styles.heading}>{provider.heading}</h3>
              {hits.map((hit) => {
                index++
                const at = index
                const active = at === snapshot.active
                return (
                  <div
                    key={hit.id}
                    ref={active ? activeRef : undefined}
                    role="option"
                    aria-selected={active}
                    className={[styles.item, active && styles.active].filter(Boolean).join(' ')}
                    onMouseMove={(event) => {
                      // Only a real pointer move selects: a list that scrolls or refills under a still pointer must not move the highlight.
                      const last = pointer.current
                      if (event.clientX === last.x && event.clientY === last.y) return
                      pointer.current = { x: event.clientX, y: event.clientY }
                      onHover(at)
                    }}
                    onClick={() => onChoose(at)}
                  >
                    <Icon className={styles.icon} size={15} strokeWidth={1.75} aria-hidden />
                    <span className={styles.text}>
                      <span className={styles.title}>{hit.title}</span>
                      {hit.detail && <span className={styles.detail}>{hit.detail}</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })
      )}
      {snapshot.error && <p className={styles.error}>{snapshot.error}</p>}
    </div>,
    document.body
  )
}
