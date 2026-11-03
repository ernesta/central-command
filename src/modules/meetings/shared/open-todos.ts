import { SERIES } from './types'
import { ownedBy, sameTodo, type TodoItem } from './todos'
import type { MeetingKey } from './carry-over'

export interface MeetingTodos extends MeetingKey {
  todos: readonly TodoItem[]
}

export interface OpenTodo {
  series: string
  /** The meeting that lists the TODO (the latest of the series that does). */
  meetingId: string
  date: string
  owners: string[]
  text: string
  kind: TodoItem['kind']
}

/**
 * The open TODOs for the landing page: every unticked Previous TODO and inline TODO of every meeting
 * (upcoming ones included), except one that a later meeting of the same series also lists, whether
 * ticked or not: carry-over copies a TODO forward, so the later copy is the one that counts. Repeats
 * within a meeting are shown once. Most recent meeting first; the same date falls back to the fixed
 * series order, then any other series by name, then the id (later first); within a meeting, the note's order.
 */
export function openTodos(meetings: readonly MeetingTodos[]): OpenTodo[] {
  const order = (s: string): number => {
    const i = (SERIES as readonly string[]).indexOf(s)
    return i === -1 ? SERIES.length : i
  }
  const dated = meetings.filter((m) => m.date)
  const sorted = [...dated].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      order(a.series) - order(b.series) ||
      a.series.localeCompare(b.series) ||
      b.id.localeCompare(a.id)
  )

  const later = (m: MeetingTodos, t: TodoItem): boolean =>
    dated.some(
      (o) =>
        o.series === m.series &&
        o.workspace === m.workspace &&
        (o.date > m.date || (o.date === m.date && o.id > m.id)) &&
        o.todos.some((x) => sameTodo(x, t))
    )

  const out: OpenTodo[] = []
  for (const m of sorted) {
    const shown: TodoItem[] = []
    for (const t of m.todos) {
      if (t.done || shown.some((x) => sameTodo(x, t)) || later(m, t)) continue
      shown.push(t)
      out.push({
        series: m.series,
        meetingId: m.id,
        date: m.date,
        owners: t.owners,
        text: t.text,
        kind: t.kind
      })
    }
  }
  return out
}

/** The "Mine" filter: only TODOs owned by the person with these initials. */
export function mine(todos: readonly OpenTodo[], initials: string): OpenTodo[] {
  return todos.filter((t) => ownedBy(t, initials))
}
