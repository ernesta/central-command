import { lateDays } from '../shared/late'
import { lineDue } from '../shared/query'
import { LateChip } from './LateChip'
import { SubtaskLine } from './SubtaskLine'
import styles from './TaskSecondLine.module.css'

/**
 * The second line of a task row that carries no chip of its own (Hours' rows, the timer's picker and popover): the place with
 * its date (`due today`, `due 12 Nov`), or, for an overdue task, `LateChip` in place of the past date. A done task shows neither.
 * `noLate` leaves the chip out (Hours' own rows: Hours is about time spent, not due dates); the line is unchanged.
 */
export function TaskSecondLine({
  parent,
  list,
  task,
  today,
  noLate = false
}: {
  parent: string | null | undefined
  list: string
  task: { due: string | null; status: string }
  today: string
  noLate?: boolean
}): React.JSX.Element {
  return (
    <span className={styles.row}>
      <span className={styles.line}>
        <SubtaskLine parent={parent} list={list} due={lineDue(task, today)} />
      </span>
      {!noLate && <LateChip days={lateDays(task, today)} />}
    </span>
  )
}
