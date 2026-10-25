import { lateDays } from '../shared/late'
import { lineDue } from '../shared/query'
import { LateChip } from './LateChip'
import { SubtaskLine } from './SubtaskLine'
import styles from './TaskSecondLine.module.css'

/**
 * The second line of a task row that carries no chip of its own (Hours' rows, the timer's picker and popover): the place with
 * its date (`due today`, `due 12 Nov`), or, for an overdue task, `LateChip` in place of the past date. A done task shows neither.
 */
export function TaskSecondLine({
  parent,
  list,
  task,
  today
}: {
  parent: string | null | undefined
  list: string
  task: { due: string | null; status: string }
  today: string
}): React.JSX.Element {
  return (
    <span className={styles.row}>
      <span className={styles.line}>
        <SubtaskLine parent={parent} list={list} due={lineDue(task, today)} />
      </span>
      <LateChip days={lateDays(task, today)} />
    </span>
  )
}
