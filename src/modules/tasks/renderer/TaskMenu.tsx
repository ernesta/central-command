import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import styles from './TaskMenu.module.css'

export interface MenuItem {
  key: string
  label: string
  icon?: React.ReactNode
  /** Shown as the current choice of its group. */
  checked?: boolean
  onSelect: () => void
}

export interface MenuGroup {
  /** A small heading above the group ("Status", "Priority"). */
  label?: string
  items: MenuItem[]
}

/**
 * A small menu at a point on the screen (a right-click, or under a button). Arrow keys move, Enter picks, Escape or a click
 * outside closes it, and the focus goes back to where it was. Portalled to the body, so no table cell clips it.
 */
export function TaskMenu({
  x,
  y,
  groups,
  label,
  onClose
}: {
  x: number
  y: number
  groups: MenuGroup[]
  label: string
  onClose: () => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const returnTo = useRef<Element | null>(document.activeElement)

  // Keep the menu on the screen: measured once it exists, then moved.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    el.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`
    el.style.top = `${Math.max(8, Math.min(y, window.innerHeight - height - 8))}px`
    const checked = el.querySelector<HTMLElement>('[aria-checked="true"]')
    ;(checked ?? el.querySelector<HTMLElement>('[role^="menuitem"]'))?.focus()
  }, [x, y])

  useEffect(() => {
    const away = (event: MouseEvent): void => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('mousedown', away)
    const back = returnTo.current
    return () => {
      document.removeEventListener('mousedown', away)
      if (back instanceof HTMLElement && document.contains(back)) back.focus()
    }
  }, [onClose])

  const onKeyDown = (event: React.KeyboardEvent): void => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])]
    const at = items.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      items[(at + step + items.length) % items.length]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus()
    } else if (event.key === 'Tab') {
      event.preventDefault()
      onClose()
    }
  }

  return createPortal(
    <div
      ref={ref}
      className={styles.menu}
      role="menu"
      aria-label={label}
      style={{ left: x, top: y }}
      onKeyDown={onKeyDown}
    >
      {groups.map((group, g) => (
        <div key={group.label ?? g} role="group" aria-label={group.label}>
          {group.label && <div className={styles.heading}>{group.label}</div>}
          {group.items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitemradio"
              aria-checked={item.checked ?? false}
              className={styles.item}
              onClick={() => {
                onClose()
                item.onSelect()
              }}
            >
              <span className={styles.icon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </div>,
    document.body
  )
}
