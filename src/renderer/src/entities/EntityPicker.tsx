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
  const menuRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)

  // Keep the row the arrows are on in view, and the whole list on the screen (above the cursor when there is no room below).
  useLayoutEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
    const menu = menuRef.current
    if (!menu || !snapshot.open) return
    const rect = menu.getBoundingClientRect()
    if (rect.bottom > window.innerHeight - EDGE && snapshot.top - rect.height - 28 > EDGE) {
      menu.style.top = `${snapshot.top - rect.height - 28}px`
    } else menu.style.top = `${snapshot.top}px`
    const left = Math.min(snapshot.left, window.innerWidth - rect.width - EDGE)
    menu.style.left = `${Math.max(EDGE, left)}px`
  })

  if (!snapshot.open) return null
  let index = -1
  return createPortal(
    <div
      ref={menuRef}
      className={styles.menu}
      style={{ left: snapshot.left, top: snapshot.top }}
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
                    onMouseMove={() => onHover(at)}
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
