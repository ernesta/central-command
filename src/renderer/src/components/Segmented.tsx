import type { ReactNode } from 'react'
import type { SelectOption } from './Select'
import styles from './Segmented.module.css'
import { Tooltip } from './Tooltip'

interface SegmentedProps<T extends string> {
  value: T
  /** An option may carry an icon, drawn before its label. */
  options: readonly (SelectOption<T> & { icon?: ReactNode; title?: string })[]
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
        <Tooltip key={o.value} text={o.title}>
          <button
            type="button"
            aria-pressed={o.value === value}
            className={[styles.segment, o.value === value && styles.active]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onChange(o.value)}
          >
            {o.icon}
            <span className={styles.label} data-label={o.label}>
              {o.label}
            </span>
          </button>
        </Tooltip>
      ))}
    </div>
  )
}
