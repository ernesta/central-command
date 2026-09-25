import { Download } from 'lucide-react'
import styles from './ExportButton.module.css'

/** "Export": used about once a year, so deliberately quiet. Same label and place in every list. */
export function ExportButton({
  onClick,
  disabled,
  title,
  busy
}: {
  onClick?: () => void
  disabled?: boolean
  title: string
  busy?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={styles.export}
      disabled={disabled || busy}
      title={title}
      onClick={onClick}
    >
      <Download size={14} strokeWidth={1.75} aria-hidden />
      {busy ? 'Exporting…' : 'Export'}
    </button>
  )
}
