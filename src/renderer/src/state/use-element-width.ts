import { useCallback, useState } from 'react'

/** The width of an element, kept up to date as it resizes: pass `ref` to the element. 0 until it is measured. */
export function useElementWidth(): { ref: (el: HTMLElement | null) => void; width: number } {
  const [width, setWidth] = useState(0)
  const ref = useCallback((el: HTMLElement | null) => {
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}
