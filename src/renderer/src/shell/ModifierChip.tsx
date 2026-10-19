import { X } from 'lucide-react'
import styles from './ModifierChip.module.css'

/**
 * A search modifier as a chip, in the shared tag style: a button that fills a value in (the help row), or a finished
 * `name:value` in the field with a × that takes it out.
 */
export function ModifierChip({
  label,
  onClick,
  onRemove
}: {
  label: string
  onClick?: () => void
  onRemove?: () => void
}): React.JSX.Element {
  if (onClick) {
    return (
      <button
        type="button"
        className={[styles.chip, styles.clickable].join(' ')}
        // The field keeps focus; the mouse fills the value in without taking it.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
      >
        {label}
      </button>
    )
  }
  return (
    <span className={styles.chip}>
      <span className={styles.label}>{label}</span>
      {onRemove && (
        <button
          type="button"
          tabIndex={-1}
          className={styles.remove}
          aria-label={`Remove ${label}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onRemove}
        >
          <X size={12} strokeWidth={1.75} aria-hidden />
        </button>
      )}
    </span>
  )
}
