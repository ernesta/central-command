import { useState } from 'react'
import { Link } from 'react-router'
import { Notice } from '@renderer/components/Notice'
import { markdownToExcerpt } from '@shared/text'
import type { OpenTodo } from '../shared/open-todos'
import { formatShortDate } from '../shared/time'
import type { MeetingWorkspace, Person } from '../shared/types'
import { meetingRoute } from './meetings-paths'
import { OwnerPill } from './OwnerPill'
import styles from './OpenTodos.module.css'

const keyOf = (todo: OpenTodo): string => `${todo.meetingId}|${todo.owners.join('&')}|${todo.text}`

/**
 * The open TODOs: a checkbox, the text with its owner as a pill after it, and where it is listed ("Series · date") at
 * the right. Ticking writes the tick into that meeting's note and the TODO leaves the list; the text opens the meeting.
 */
export function OpenTodos({
  todos,
  people,
  workspace
}: {
  todos: OpenTodo[]
  people: Person[]
  workspace: MeetingWorkspace
}): React.JSX.Element {
  // Hidden as soon as it is ticked, so the list does not wait for the file to be written and read back.
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const tick = (todo: OpenTodo, key: string): void => {
    setError(null)
    setTicked((s) => new Set(s).add(key))
    window.api.meetings
      .tickTodo({ workspace, id: todo.meetingId }, { owners: todo.owners, text: todo.text })
      .catch((e: unknown) => {
        setTicked((s) => {
          const next = new Set(s)
          next.delete(key)
          return next
        })
        setError(e instanceof Error ? e.message : 'Couldn’t tick that TODO.')
      })
  }

  return (
    <>
      {error && (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      )}
      <ul className={styles.list}>
        {todos.map((todo) => {
          const key = keyOf(todo)
          if (ticked.has(key)) return null
          return (
            <li key={key} className={styles.item}>
              <input
                type="checkbox"
                className={styles.box}
                checked={false}
                aria-label={`Done: ${markdownToExcerpt(todo.text, 80)}`}
                onChange={() => tick(todo, key)}
              />
              <Link className={styles.row} to={meetingRoute(workspace, todo.meetingId)}>
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
          )
        })}
      </ul>
    </>
  )
}
