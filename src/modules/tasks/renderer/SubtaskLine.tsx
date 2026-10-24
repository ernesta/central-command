import { CornerDownRight } from 'lucide-react'
import { taskLine } from '../shared/query'
import styles from './SubtaskLine.module.css'

/**
 * A task's second line. A subtask says what it belongs to, `↳ <parent> · <list>`, with the parent cut by an ellipsis before the
 * list is; any other task keeps `<list> · <rest>`. `rest` is what the place adds after the list (a due date), only where it shows one.
 * The parent is plain text: never a link or a chip.
 */
export function SubtaskLine({
  parent,
  list,
  rest
}: {
  parent: string | null | undefined
  list: string
  rest?: string | false | null
}): React.JSX.Element {
  if (parent == null) return <span className={styles.plain}>{taskLine(list, rest)}</span>
  return (
    <span className={styles.line}>
      <CornerDownRight size={12} strokeWidth={1.75} className={styles.mark} aria-hidden />
      <span className={styles.parent}>{parent || 'Untitled'}</span>
      {(list || rest) && <span className={styles.tail}> · {taskLine(list, rest)}</span>}
    </span>
  )
}
