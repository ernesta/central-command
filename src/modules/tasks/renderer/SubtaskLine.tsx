import { CornerDownRight } from 'lucide-react'
import { taskLine } from '../shared/query'
import styles from './SubtaskLine.module.css'

/**
 * A task's second line. A subtask says what it belongs to, `↳ <parent> · <list>`, with the parent cut by an ellipsis before the
 * list is; any other task keeps `<list> · <due>`. `due` is the date as `dueText` words it (`lineDue` leaves it out for a done or overdue task), only where the
 * place shows one: a row that carries a chip or sits in a section that says the date does not repeat it.
 * The parent is plain text: never a link or a chip.
 */
export function SubtaskLine({
  parent,
  list,
  due
}: {
  parent: string | null | undefined
  list: string
  due?: string | false | null
}): React.JSX.Element {
  if (parent == null) return <span className={styles.plain}>{taskLine(list, due)}</span>
  return (
    <span className={styles.line}>
      <CornerDownRight size={12} strokeWidth={1.75} className={styles.mark} aria-hidden />
      <span className={styles.parent}>{parent || 'Untitled'}</span>
      {(list || due) && <span className={styles.tail}> · {taskLine(list, due)}</span>}
    </span>
  )
}
