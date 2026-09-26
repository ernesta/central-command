export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

interface Size {
  width: number
  height: number
}

/** How much of a remembered window has to be on a screen for its position to be kept (so it can be grabbed and moved). */
const VISIBLE = 100

/**
 * Where to open the window: as it was left, if that is still on a screen that exists (a screen may have been unplugged), and
 * otherwise in the default size wherever the system puts it. The size never goes below the window's minimum.
 */
export function restoreBounds(
  saved: Bounds | null,
  workAreas: readonly Bounds[],
  defaults: Size,
  min: Size
): Partial<Bounds> & Size {
  if (!saved) return { ...defaults }
  const size = {
    width: Math.max(min.width, Math.round(saved.width)),
    height: Math.max(min.height, Math.round(saved.height))
  }
  const onScreen = workAreas.some((area) => {
    const overlapX = Math.min(saved.x + size.width, area.x + area.width) - Math.max(saved.x, area.x)
    const overlapY =
      Math.min(saved.y + size.height, area.y + area.height) - Math.max(saved.y, area.y)
    return overlapX >= VISIBLE && overlapY >= VISIBLE
  })
  return onScreen ? { ...size, x: Math.round(saved.x), y: Math.round(saved.y) } : size
}
