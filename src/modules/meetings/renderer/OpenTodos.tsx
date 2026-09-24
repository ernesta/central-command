import { Link } from 'react-router'
import { markdownToExcerpt } from '@shared/text'
import type { OpenTodo } from '../shared/open-todos'
import { formatShortDate } from '../shared/time'
import type { Person } from '../shared/types'
import { meetingRoute } from './meetings-paths'
import { OwnerPill } from './OwnerPill'
import styles from './OpenTodos.module.css'

/**
 * The open TODOs: the text, its owner as a pill after it, and where it is listed ("Series · date") at the
 * right. Read-only; a row opens the meeting it is listed in.
 */
export function OpenTodos({
  todos,
  people
}: {
  todos: OpenTodo[]
  people: Person[]
}): React.JSX.Element {
  return (
    <ul className={styles.list}>
      {todos.map((todo, index) => (
        <li key={`${todo.meetingId}-${index}`}>
          <Link className={styles.row} to={meetingRoute(todo.meetingId)}>
            <span className={styles.ring} aria-hidden />
            <span className={styles.text}>
              {markdownToExcerpt(todo.text, 400)}
              {todo.owners.map((o) => (
                <OwnerPill key={o} initials={o} people={people} />
              ))}
            </span>
            <span className={styles.source}>
              {todo.series} · {formatShortDate(todo.date)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
