import { useState } from 'react'
import { Select } from '@renderer/components/Select'
import { RECURRENCE_PRESETS, recurrenceKey } from '../shared/recurrence'
import { RECURRENCE_UNITS, type Recurrence, type RecurrenceUnit } from '../shared/types'
import styles from './RecurrenceField.module.css'

/**
 * How a task repeats: Never, a named rule, or "Every N days, weeks or months". The next one is made when this one is
 * done, due the interval after that day.
 */
export function RecurrenceField({
  value,
  onChange
}: {
  value: Recurrence | null
  onChange: (rule: Recurrence | null) => void
}): React.JSX.Element {
  const key = recurrenceKey(value)
  // Choosing "Custom" shows the number and unit before there is a rule that is not a named one.
  const [custom, setCustom] = useState(false)
  const showCustom = custom || key === 'custom'
  const [count, setCount] = useState(String(value?.every ?? 3))
  const rule = value ?? { every: 3, unit: 'day' as RecurrenceUnit }

  return (
    <span className={styles.wrap}>
      <Select
        label="Repeats"
        compact
        value={showCustom ? 'custom' : key}
        options={[
          { value: 'never', label: 'Never' },
          ...RECURRENCE_PRESETS.map((p) => ({ value: p.key, label: p.label })),
          { value: 'custom', label: 'Custom' }
        ]}
        onChange={(next) => {
          if (next === 'never') {
            setCustom(false)
            onChange(null)
          } else if (next === 'custom') {
            setCustom(true)
            onChange(key === 'custom' ? value : { every: 3, unit: 'day' })
          } else {
            setCustom(false)
            onChange(RECURRENCE_PRESETS.find((p) => p.key === next)?.rule ?? null)
          }
        }}
      />
      {showCustom && (
        <>
          <span className={styles.every}>Every</span>
          <input
            className={styles.count}
            type="number"
            min={1}
            max={366}
            aria-label="Repeat every"
            value={count}
            onChange={(event) => {
              setCount(event.target.value)
              const n = Number(event.target.value)
              if (Number.isInteger(n) && n >= 1 && n <= 366) onChange({ every: n, unit: rule.unit })
            }}
          />
          <Select<RecurrenceUnit>
            label="Repeat unit"
            compact
            value={rule.unit}
            options={RECURRENCE_UNITS.map((u) => ({ value: u, label: `${u}s` }))}
            onChange={(unit) => onChange({ every: rule.every, unit })}
          />
        </>
      )}
    </span>
  )
}
