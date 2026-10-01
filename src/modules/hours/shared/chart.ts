/** Geometry helpers for the hand-drawn Hours charts: pure, so they are tested without a DOM. */

/** A y-axis top and its ticks for values from 0 to `max`: round numbers, at most about `count` of them. */
export function niceAxis(max: number, step: number): { top: number; ticks: number[] } {
  const top = Math.max(step, Math.ceil(max / step) * step)
  const ticks: number[] = []
  for (let v = 0; v <= top; v += step) ticks.push(v)
  return { top, ticks }
}

/** A column with a rounded top and a square foot, as an SVG path. `r` is capped by the height and half the width. */
export function columnPath(x: number, y: number, w: number, h: number, radius: number): string {
  if (h <= 0 || w <= 0) return ''
  const r = Math.min(radius, h, w / 2)
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`
}

/** The index of the slot (of `count`, each `slot` wide, starting at `left`) a horizontal position falls in, or null. */
export function slotAt(x: number, left: number, slot: number, count: number): number | null {
  if (slot <= 0) return null
  const i = Math.floor((x - left) / slot)
  return i >= 0 && i < count ? i : null
}
