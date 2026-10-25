import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { isCut, placeTip, TOOLTIP_DELAY_MS } from './tooltip-place'
import styles from './Tooltip.module.css'

interface TooltipProps {
  /** What the tip says. Empty or missing: no tip at all. */
  text: string | undefined | null
  /** Show the tip only when the child's text is actually cut off (it ellipsises). */
  whenCut?: boolean
  /** Never show (the tip is only for the enabled state). */
  disabled?: boolean
  /** One element: the tip points at it and describes it. */
  children: ReactNode
}

/**
 * The one tooltip. Wraps one element without adding a box (`display: contents`); the tip is drawn in a
 * fixed layer on the body, so no `overflow` ancestor clips it. Shown after a short pause on hover and on
 * keyboard focus (not after a click), hidden on scroll, Escape, blur and leaving.
 */
export function Tooltip({ text, whenCut, disabled, children }: TooltipProps): React.JSX.Element {
  const id = useId()
  const wrapRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const active = !!text && !disabled

  const hide = useCallback(() => {
    window.clearTimeout(timer.current)
    setAnchor(null)
    setPos(null)
  }, [])

  const show = useCallback(
    (delay: number) => {
      const el = wrapRef.current?.firstElementChild
      if (!active || !(el instanceof HTMLElement)) return
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        if (whenCut && !isCut(el)) return
        setAnchor(el)
      }, delay)
    },
    [active, whenCut]
  )

  useLayoutEffect(() => {
    if (!anchor || !tipRef.current) return
    const a = anchor.getBoundingClientRect()
    const t = tipRef.current.getBoundingClientRect()
    setPos(placeTip(a, t, { width: window.innerWidth, height: window.innerHeight }))
  }, [anchor, text])

  useEffect(() => {
    if (!anchor) return
    anchor.setAttribute('aria-describedby', id)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') hide()
    }
    window.addEventListener('scroll', hide, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', hide)
    return () => {
      anchor.removeAttribute('aria-describedby')
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', hide)
    }
  }, [anchor, hide, id])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <span
      ref={wrapRef}
      className={styles.wrap}
      onMouseEnter={() => show(TOOLTIP_DELAY_MS)}
      onMouseLeave={hide}
      onMouseDown={hide}
      onFocus={(e) => {
        if (e.target instanceof Element && e.target.matches(':focus-visible'))
          show(TOOLTIP_DELAY_MS)
      }}
      onBlur={hide}
    >
      {children}
      {anchor && active
        ? createPortal(
            <span
              ref={tipRef}
              id={id}
              role="tooltip"
              className={styles.tip}
              style={
                pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }
              }
            >
              {text}
            </span>,
            document.body
          )
        : null}
    </span>
  )
}
