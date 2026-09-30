import { useEffect, useRef, useState } from 'react'
import type { Extension } from '@codemirror/state'
import type { OwnerOption } from '../shared/people'
import {
  liveTodoHelper,
  type MenuKey,
  type TodoMenuBridge,
  type TodoMenuRequest
} from './todo-live'
import styles from './TodoMenu.module.css'

interface Item {
  initials: string | null
  name: string
  attendee: boolean
}

interface Open {
  request: TodoMenuRequest
  x: number
  y: number
}

/**
 * The menu's behaviour, built once per editor. It keeps its own copy of what the editor's key handler
 * needs (is the menu open, which row is active, which rows exist) and tells React through two setters,
 * so the editor never sees a stale closure.
 */
class TodoMenuController implements TodoMenuBridge {
  current: Open | null = null
  activeIndex = 0
  items: Item[] = []

  constructor(
    private readonly setOpen: (open: Open | null) => void,
    private readonly setActive: (index: number) => void
  ) {}

  open = (request: TodoMenuRequest): void => {
    this.current = { request, x: request.at.left, y: request.at.bottom }
    this.activeIndex = 0
    this.setActive(0)
    this.setOpen(this.current)
  }

  close = (): void => {
    this.current = null
    this.setOpen(null)
  }

  isOpen = (): boolean => this.current !== null

  setItems = (items: Item[]): void => {
    this.items = items
  }

  highlight = (index: number): void => {
    this.activeIndex = index
    this.setActive(index)
  }

  pick = (index: number): void => {
    const current = this.current
    const item = this.items[index]
    if (!current || !item) return
    this.close()
    current.request.insert(item.initials)
  }

  key = (key: MenuKey): boolean => {
    const count = this.items.length
    if (key === 'escape') this.close()
    else if (key === 'enter') this.pick(this.activeIndex)
    else this.highlight((this.activeIndex + (key === 'down' ? 1 : count - 1)) % count)
    return true
  }
}

/**
 * The TODO owner menu for the notes editor. `live` goes to `LiveEditor`'s `extensions`; render `menu` anywhere in
 * the page. The owners are read when the menu opens, so changing the attendees needs no new editor.
 */
export function useTodoHelper(owners: readonly OwnerOption[]): {
  /** The helper, as a CodeMirror extension for `LiveEditor`'s `extensions`. */
  live: Extension
  menu: React.ReactNode
} {
  const [open, setOpen] = useState<Open | null>(null)
  const [active, setActive] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const [controller] = useState(() => new TodoMenuController(setOpen, setActive))

  const items: Item[] = [
    ...owners.map((o) => ({ initials: o.initials, name: o.name, attendee: o.attendee })),
    { initials: null, name: 'No owner', attendee: false }
  ]
  useEffect(() => {
    controller.setItems(items)
  })

  const [live] = useState(() => liveTodoHelper(controller))

  // A click anywhere outside the menu closes it.
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) controller.close()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, controller])

  const menu = open ? (
    <div
      ref={menuRef}
      className={styles.menu}
      role="listbox"
      aria-label="Who is this TODO for?"
      style={{
        left: Math.min(open.x, window.innerWidth - 260),
        top: Math.min(open.y + 6, window.innerHeight - 40 - items.length * 36)
      }}
    >
      {items.map((item, index) => (
        <div
          key={item.initials ?? 'none'}
          role="option"
          aria-selected={index === active}
          className={[styles.item, index === active && styles.active].filter(Boolean).join(' ')}
          // Keep the cursor in the note: the menu must never take focus.
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => controller.highlight(index)}
          onClick={() => controller.pick(index)}
        >
          {item.initials ? <span className={styles.initials}>{item.initials}</span> : null}
          <span className={styles.name}>{item.name}</span>
          {item.initials && !item.attendee && (
            <span className={styles.hint}>not at this meeting</span>
          )}
        </div>
      ))}
    </div>
  ) : null

  return { live, menu }
}
