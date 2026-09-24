import { useId, useState } from 'react'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import styles from './PathField.module.css'

interface PathFieldProps {
  label: string
  help: string
  value: string
  placeholder?: string
  kind: 'file' | 'folder'
  extensions?: string[]
  onCommit: (value: string) => void
}

/** A text field for a filesystem path with a native Browse button. Commits on blur, Enter or after browsing. */
export function PathField({
  label,
  help,
  value,
  placeholder,
  kind,
  extensions,
  onCommit
}: PathFieldProps): React.JSX.Element {
  const id = useId()
  const [draft, setDraft] = useState(value)
  // Follow external changes to the saved value (e.g. after Browse) without an effect.
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setDraft(value)
  }

  const commit = (next: string): void => {
    const trimmed = next.trim()
    if (trimmed !== value) onCommit(trimmed)
  }

  const browse = async (): Promise<void> => {
    const picked = await window.api.dialog.pickPath({
      kind,
      title: label,
      defaultPath: draft || undefined,
      extensions
    })
    if (picked) commit(picked)
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <p className={styles.help}>{help}</p>
      <div className={styles.row}>
        <Input
          id={id}
          className={styles.input}
          value={draft}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => e.key === 'Enter' && commit(draft)}
        />
        <Button onClick={browse}>Browse…</Button>
      </div>
    </div>
  )
}
