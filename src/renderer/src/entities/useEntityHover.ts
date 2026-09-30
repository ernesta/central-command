import { useEffect, useRef, useState } from 'react'
import { parseEntityHref } from '@shared/entities'
import type { HoverTarget } from './EntityHoverCard'

const HOVER_DELAY_MS = 350

/**
 * A mention the pointer rests on shows what it points at (a card under it); moving on, typing or scrolling hides it.
 * `selector` finds a mention among the elements under the pointer; it carries `data-kind` and `data-key`.
 */
export function useEntityHover(selector: string): {
  hover: HoverTarget | null
  onMouseOver: (event: React.MouseEvent) => void
  onMouseOut: () => void
  stop: () => void
} {
  const [hover, setHover] = useState<HoverTarget | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stop = (): void => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setHover(null)
  }
  useEffect(() => {
    const hide = (): void => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      setHover(null)
    }
    window.addEventListener('keydown', hide)
    window.addEventListener('scroll', hide, true)
    return () => {
      window.removeEventListener('keydown', hide)
      window.removeEventListener('scroll', hide, true)
    }
  }, [])
  const onMouseOver = (event: React.MouseEvent): void => {
    const mention = (event.target as HTMLElement).closest<HTMLElement>(selector)
    if (!mention) return
    const kind = mention.dataset.kind
    const key = mention.dataset.key
    const ref = kind && key ? parseEntityHref(`cc://${kind}/${encodeURIComponent(key)}`) : null
    if (!ref) return
    if (timer.current) clearTimeout(timer.current)
    const rect = mention.getBoundingClientRect()
    const label = mention.textContent ?? ''
    timer.current = setTimeout(
      () => setHover({ ref, label, rect: { left: rect.left, bottom: rect.bottom } }),
      HOVER_DELAY_MS
    )
  }
  return { hover, onMouseOver, onMouseOut: stop, stop }
}
