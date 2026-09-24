import type { SelectHTMLAttributes } from 'react'
import styles from './Select.module.css'

export interface SelectOption<T extends string> {
  value: T
  label: string
}

interface SelectProps<T extends string> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'onChange'
> {
  value: T
  options: readonly SelectOption<T>[]
  onChange: (value: T) => void
  /** Required: selects usually have no visible label of their own. */
  label: string
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  ...rest
}: SelectProps<T>): React.JSX.Element {
  return (
    <select
      aria-label={label}
      className={[styles.select, className].filter(Boolean).join(' ')}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      {...rest}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
