import { createPortal } from 'react-dom'
import { useSyncExternalStore } from 'react'
import type { EntityRef } from '@shared/entities'
import type { EntityPickerController } from './picker-controller'
import { providerFor } from './registry'
import styles from './EntityHoverCard.module.css'

export interface HoverTarget {
  ref: EntityRef
  /** What the mention says in the text (the card's title when the entity is gone). */
  label: string
  /** Where the mention is on the screen. */
  rect: { left: number; bottom: number }
}

/**
 * A small card under a mention the pointer rests on: what kind of thing it is, what it is called now and one line about
 * it, or that it no longer exists. Never takes the pointer, so moving on simply hides it.
 */
export function EntityHoverCard({
  controller,
  target
}: {
  controller: EntityPickerController
  target: HoverTarget
}): React.JSX.Element {
  const resolved = useSyncExternalStore(controller.subscribeResolved, () =>
    controller.resolve(target.ref)
  )
  const provider = providerFor(target.ref.kind)
  const Icon = provider?.icon
  const summary = resolved.state === 'found' ? resolved.summary : null
  return createPortal(
    <div
      className={styles.card}
      style={{ left: target.rect.left, top: target.rect.bottom + 6 }}
      role="tooltip"
    >
      <div className={styles.kind}>
        {Icon && <Icon size={13} strokeWidth={1.75} aria-hidden />}
        <span>{provider?.noun ?? target.ref.kind}</span>
      </div>
      <div className={styles.title}>{summary?.title ?? target.label}</div>
      {resolved.state === 'missing' ? (
        <div className={styles.gone}>No longer available</div>
      ) : (
        summary?.detail && <div className={styles.detail}>{summary.detail}</div>
      )}
      {summary && <div className={styles.hint}>Cmd-click to open</div>}
    </div>,
    document.body
  )
}
