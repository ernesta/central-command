import type { ReactNode } from 'react'
import { Tooltip } from './Tooltip'
import styles from './CutText.module.css'

/** Text on one line that ellipsises; its full text is a tooltip, shown only when it is actually cut. */
export function CutText({
  text,
  className,
  children
}: {
  /** What the tooltip says; defaults to `children` when that is a string. */
  text?: string
  className?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <Tooltip text={text ?? (typeof children === 'string' ? children : undefined)} whenCut>
      <span className={[styles.cut, className].filter(Boolean).join(' ')}>{children}</span>
    </Tooltip>
  )
}
