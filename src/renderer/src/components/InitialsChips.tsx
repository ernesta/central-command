import { Tooltip } from './Tooltip'
import styles from './ListTable.module.css'

const VISIBLE = 3

/** People as initials pills (three at most, each with the full name as its tooltip), then a muted "+N" that lists the others. */
export function InitialsChips({
  names,
  initials
}: {
  names: readonly string[]
  initials: (name: string) => string
}): React.JSX.Element {
  const shown = names.slice(0, VISIBLE)
  const rest = names.slice(VISIBLE)
  return (
    <div className={styles.people}>
      {shown.map((name) => (
        <Tooltip key={name} text={name}>
          <span className={styles.chip}>{initials(name)}</span>
        </Tooltip>
      ))}
      {rest.length > 0 && (
        <Tooltip text={rest.join(', ')}>
          <span className={styles.more}>+{rest.length}</span>
        </Tooltip>
      )}
    </div>
  )
}
