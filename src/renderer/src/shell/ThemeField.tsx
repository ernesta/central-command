import { useId } from 'react'
import { THEMES, type ThemeChoice } from '@shared/settings'
import { Select } from '../components/Select'
import styles from './PathField.module.css'

interface ThemeFieldProps {
  value: ThemeChoice
  onChange: (value: ThemeChoice) => void
}

/** Light, dark, or following the system. Uses the same label and help layout as PathField. */
export function ThemeField({ value, onChange }: ThemeFieldProps): React.JSX.Element {
  const id = useId()
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        Theme
      </label>
      <p className={styles.help}>System follows your Mac’s light or dark setting.</p>
      <div className={styles.row}>
        <Select
          id={id}
          label="Theme"
          value={value}
          options={THEMES.map((t) => ({ value: t.id, label: t.label }))}
          onChange={onChange}
        />
      </div>
    </div>
  )
}
