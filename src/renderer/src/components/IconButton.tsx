import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { formatChord } from '@shared/shortcuts'
import styles from './IconButton.module.css'

const isMac = /Mac/i.test(navigator.platform || navigator.userAgent)

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: the button has no visible text. Shown as a hover label. */
  label: string
  /** A chord (`Mod-k`), shown after the label in the hover tooltip: "Search (⌘K)". */
  shortcut?: string
  children: ReactNode
}

/** An icon-only button with a hover/focus tooltip showing its label and, if given, its keyboard shortcut. */
export function IconButton({
  label,
  shortcut,
  children,
  className,
  ...rest
}: IconButtonProps): React.JSX.Element {
  const tip = shortcut ? `${label} (${formatChord(shortcut, isMac).join('')})` : label
  return (
    <span className={styles.wrap}>
      <button
        type="button"
        aria-label={label}
        className={[styles.iconButton, className].filter(Boolean).join(' ')}
        {...rest}
      >
        {children}
      </button>
      <span className={styles.tip} role="tooltip">
        {tip}
      </span>
    </span>
  )
}
