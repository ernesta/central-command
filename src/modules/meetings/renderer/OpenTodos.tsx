import { useState } from 'react'
import { Link } from 'react-router'
import { Notice } from '@renderer/components/Notice'
import { ShowMore } from '@renderer/components/ShowMore'
import { pushUndo } from '@renderer/components/undo-store'
import { markdownToExcerpt } from '@shared/text'
import type { OpenTodo } from '../shared/open-todos'
import { formatShortDate } from '../shared/time'
import type { MeetingWorkspace, Person } from '../shared/types'
import { meetingRoute } from './meetings-paths'
import { OwnerPill } from './OwnerPill'
import styles from './OpenTodos.module.css'

/** How many TODOs show before "Show all" (as the Tasks landing's sections). */
const TODO_LIMIT = 5

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
  const [expanded, setExpanded] = useState(false)

  const tick = (todo: OpenTodo, key: string): void => {
    setError(null)
    setTicked((s) => new Set(s).add(key))
    const ref = { workspace, id: todo.meetingId }
    window.api.meetings
      .tickTodo(ref, { owners: todo.owners, text: todo.text })
      .then(({ previousBody, hash }) => {
        // Cmd-Z writes the body back, only while nothing else has changed the meeting since.
        pushUndo({
          label: 'tick of a TODO',
          undo: async () => {
            const back = await window.api.meetings.save(ref, { body: previousBody }, hash)
            if (back.status === 'conflict') throw new Error('The meeting changed since')
            setTicked((s) => {
              const next = new Set(s)
              next.delete(key)
              return next
            })
          }
        })
      })
      .catch((e: unknown) => {
        setTicked((s) => {
          const next = new Set(s)
          next.delete(key)
          return next
        })
        setError(e instanceof Error ? e.message : 'Couldn’t tick that TODO.')
      })
  }

  const open = todos.filter((todo) => !ticked.has(keyOf(todo)))
  const shown = expanded ? open : open.slice(0, TODO_LIMIT)

  return (
    <>
      {error && (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      )}
      <ul className={styles.list}>
        {shown.map((todo) => {
          const key = keyOf(todo)
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
      <div className={styles.more}>
        <ShowMore
          shown={shown.length}
          total={open.length}
          limit={TODO_LIMIT}
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
        />
      </div>
    </>
  )
}
