import { useId } from 'react'
import { TERMINALS, type TerminalId } from '@shared/settings'
import { Select } from '../components/Select'
import styles from './PathField.module.css'

interface TerminalFieldProps {
  value: TerminalId
  onChange: (value: TerminalId) => void
}

/** Which terminal app the Build button opens. Uses the same label and help layout as PathField. */
export function TerminalField({ value, onChange }: TerminalFieldProps): React.JSX.Element {
  const id = useId()
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        Terminal
      </label>
      <p className={styles.help}>The app the Build button opens a Claude Code session in.</p>
      <div className={styles.row}>
        <Select
          id={id}
          label="Terminal"
          value={value}
          options={TERMINALS.map((t) => ({ value: t.id, label: t.label }))}
          onChange={onChange}
        />
      </div>
    </div>
  )
}
