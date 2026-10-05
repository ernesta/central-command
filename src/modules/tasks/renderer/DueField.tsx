import { Select } from '@renderer/components/Select'
import { formatDue, presetDate, presetOf, type DuePreset } from '../shared/query'
import styles from './DueField.module.css'

/**
 * A due date as a choice: Today, Tomorrow, Next week, No date, or a date picked from a calendar. A date that is
 * none of the first three shows as itself.
 */
export function DueField({
  value,
  today,
  onChange,
  label = 'Due'
}: {
  value: string | null
  today: string
  onChange: (due: string | null) => void
  label?: string
}): React.JSX.Element {
  const preset = presetOf(value, today)
  const options: { value: DuePreset; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: 'week', label: 'Next week' },
    { value: 'none', label: 'No date' },
    { value: 'date', label: value && preset === 'date' ? formatDue(value, today) : 'Pick a date' }
  ]
  return (
    <span className={styles.wrap}>
      <Select<DuePreset>
        label={label}
        compact
        value={preset}
        options={options}
        onChange={(next) => {
          if (next === 'date') onChange(value && preset === 'date' ? value : today)
          else onChange(presetDate(next, today))
        }}
      />
      {preset === 'date' && (
        <input
          className={styles.date}
          type="date"
          aria-label={`${label} date`}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value || null)}
        />
      )}
    </span>
  )
}
