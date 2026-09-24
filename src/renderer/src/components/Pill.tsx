import type { ButtonHTMLAttributes } from 'react'
import styles from './Pill.module.css'

interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

/** A navigation pill, e.g. a workspace switcher entry. */
export function Pill({ active = false, className, ...rest }: PillProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-current={active ? 'true' : undefined}
      className={[styles.pill, active && styles.active, className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}
