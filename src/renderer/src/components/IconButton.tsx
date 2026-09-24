import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './IconButton.module.css'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: the button has no visible text. */
  label: string
  children: ReactNode
}

export function IconButton({ label, children, className, ...rest }: IconButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[styles.iconButton, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
