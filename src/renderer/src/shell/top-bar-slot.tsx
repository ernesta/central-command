import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import styles from './TopBar.module.css'

let slot: HTMLElement | null = null
const listeners = new Set<() => void>()

function setSlot(element: HTMLElement | null): void {
  slot = element
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The place in the top bar, left of Build, that a module's global can draw into (the Hours timer chip). */
export function TopBarSlot(): React.JSX.Element {
  return <div ref={setSlot} className={styles.slot} />
}

/** Draws its children in the top bar's slot, from anywhere in the tree. Nothing until the bar is there. */
export function TopBarPortal({
  children
}: {
  children: React.ReactNode
}): React.ReactPortal | null {
  const element = useSyncExternalStore(subscribe, () => slot)
  return element ? createPortal(children, element) : null
}
