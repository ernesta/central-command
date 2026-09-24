import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  heading: string
  message?: string
  children?: ReactNode
}

export function EmptyState({ heading, message, children }: EmptyStateProps): React.JSX.Element {
  return (
    <div className={styles.empty}>
      <h2 className={styles.heading}>{heading}</h2>
      {message && <p className={styles.message}>{message}</p>}
      {children}
    </div>
  )
}
