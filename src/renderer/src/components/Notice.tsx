import type { ReactNode } from 'react'
import styles from './Notice.module.css'

interface NoticeProps {
  tone?: 'info' | 'error'
  children: ReactNode
  /** Extra controls next to the message, e.g. a filter shortcut. */
  action?: ReactNode
  onDismiss?: () => void
}

/** A calm, non-blocking message. Errors use the danger colour; nothing here is modal. */
export function Notice({
  tone = 'info',
  children,
  action,
  onDismiss
}: NoticeProps): React.JSX.Element {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={[styles.notice, tone === 'error' && styles.error].filter(Boolean).join(' ')}
    >
      <div className={styles.body}>
        <span>{children}</span>
        {action}
      </div>
      {onDismiss && (
        <button type="button" className={styles.dismiss} onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  )
}
