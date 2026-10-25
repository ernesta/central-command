/** The pause before a tip appears, so crossing the screen with the pointer does not flash tips. */
export const TOOLTIP_DELAY_MS = 350
const GAP = 6
const MARGIN = 8

/** True when the element's text does not fit, i.e. an ellipsis is showing. */
export function isCut(el: Element | null): boolean {
  return (
    el instanceof HTMLElement &&
    (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight + 1)
  )
}

/** Where a tip of `size` goes for an `anchor` inside a `win`: below and centred, above when there is no room, kept inside the window. */
export function placeTip(
  anchor: { left: number; top: number; width: number; height: number },
  size: { width: number; height: number },
  win: { width: number; height: number }
): { left: number; top: number } {
  const below = anchor.top + anchor.height + GAP
  const above = anchor.top - GAP - size.height
  const top = below + size.height + MARGIN > win.height && above >= MARGIN ? above : below
  const centred = anchor.left + anchor.width / 2 - size.width / 2
  const left = Math.max(MARGIN, Math.min(centred, win.width - size.width - MARGIN))
  return { left, top }
}
