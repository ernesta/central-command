import type { SelectOption } from './Select'
import styles from './Segmented.module.css'

interface SegmentedProps<T extends string> {
  value: T
  options: readonly SelectOption<T>[]
  onChange: (value: T) => void
  label: string
}

/** Segmented single-choice control, e.g. Table / Board. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label
}: SegmentedProps<T>): React.JSX.Element {
  return (
    <div role="group" aria-label={label} className={styles.group}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          className={[styles.segment, o.value === value && styles.active].filter(Boolean).join(' ')}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
