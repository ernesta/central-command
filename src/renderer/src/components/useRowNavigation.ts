import { useRef, useState } from 'react'

const PAGE = 8

/**
 * Keyboard handling for a table of rows that open something: the table is one tab stop, arrow keys, Home/End and
 * PageUp/PageDown move between rows, and Enter opens the focused row. Spread `tableProps` on the `<table>` and
 * `rowProps(index)` on each `<tr>`.
 */
export function useRowNavigation(
  count: number,
  open: (index: number) => void
): {
  tableProps: { onBlur: (event: React.FocusEvent<HTMLTableElement>) => void }
  rowProps: (index: number) => {
    ref: (el: HTMLTableRowElement | null) => void
    tabIndex: number
    onFocus: () => void
    onKeyDown: (event: React.KeyboardEvent) => void
  }
} {
  const [active, setActive] = useState(0)
  const rowEls = useRef<(HTMLTableRowElement | null)[]>([])
  // Keep the tab stop valid when the list shrinks (search, filters).
  const activeIndex = Math.min(active, Math.max(count - 1, 0))

  const move = (next: number): void => {
    const clamped = Math.max(0, Math.min(count - 1, next))
    setActive(clamped)
    rowEls.current[clamped]?.focus()
  }

  return {
    // Tabbing out of the table resets the tab stop to the first row, so coming back does not land mid-list.
    tableProps: {
      onBlur: (event) => {
        const next = event.relatedTarget
        if (next instanceof Node && !event.currentTarget.contains(next)) setActive(0)
      }
    },
    rowProps: (index) => ({
      ref: (el) => {
        rowEls.current[index] = el
      },
      tabIndex: index === activeIndex ? 0 : -1,
      onFocus: () => setActive(index),
      onKeyDown: (event) => {
        const keys: Record<string, number> = {
          ArrowDown: index + 1,
          ArrowUp: index - 1,
          PageDown: index + PAGE,
          PageUp: index - PAGE,
          Home: 0,
          End: count - 1
        }
        if (event.key in keys) {
          event.preventDefault()
          move(keys[event.key])
        } else if (event.key === 'Enter') {
          event.preventDefault()
          open(index)
        }
      }
    })
  }
}
