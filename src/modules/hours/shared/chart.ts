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

/**
 * An axis for values that can go below zero: the lowest and highest tick are whole steps that hold `min` and
 * `max`, and zero is always a tick. The step is the smallest of `steps` that keeps the ticks to `maxTicks`.
 */
export function niceRange(
  min: number,
  max: number,
  steps: readonly number[],
  maxTicks = 7
): { bottom: number; top: number; step: number; ticks: number[] } {
  const low = Math.min(min, 0)
  const high = Math.max(max, 0)
  const step =
    steps.find((s) => Math.ceil(high / s) - Math.floor(low / s) < maxTicks) ??
    steps[steps.length - 1]
  const bottom = Math.floor(low / step) * step
  const top = Math.max(Math.ceil(high / step) * step, bottom + step)
  const ticks: number[] = []
  for (let v = bottom; v <= top; v += step) ticks.push(v)
  return { bottom, top, step, ticks }
}

/** A polyline through the points as an SVG path (`M x y L x y …`); empty for no points. */
export function linePath(points: readonly { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join('')
}
