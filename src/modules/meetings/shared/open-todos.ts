import { SERIES } from './types'
import { ownedBy, sameTodo, type TodoItem } from './todos'
import type { MeetingKey } from './carry-over'

export interface MeetingTodos extends MeetingKey {
  todos: readonly TodoItem[]
}

export interface OpenTodo {
  series: string
  /** The latest meeting of the series, where the TODO is listed. */
  meetingId: string
  date: string
  owners: string[]
  text: string
  kind: TodoItem['kind']
}

/**
 * The open TODOs for the landing page: for each series, take its latest meeting (upcoming ones
 * included) and list its unticked Previous TODOs plus its inline TODOs. Repeats within a meeting are
 * shown once. Series come in the fixed order, then any other by name; within a series, the note's order.
 */
export function openTodos(meetings: readonly MeetingTodos[]): OpenTodo[] {
  const latest = new Map<string, MeetingTodos>()
  for (const m of meetings) {
    if (!m.date) continue
    const best = latest.get(m.series)
    if (!best || best.date < m.date || (best.date === m.date && best.id < m.id))
      latest.set(m.series, m)
  }
  const order = (s: string): number => {
    const i = (SERIES as readonly string[]).indexOf(s)
    return i === -1 ? SERIES.length : i
  }
  const series = [...latest.keys()].sort((a, b) => order(a) - order(b) || a.localeCompare(b))

  const out: OpenTodo[] = []
  for (const s of series) {
    const m = latest.get(s)!
    const open = m.todos.filter((t) => !t.done)
    const shown: TodoItem[] = []
    for (const t of open) {
      if (shown.some((x) => sameTodo(x, t))) continue
      shown.push(t)
      out.push({
        series: s,
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
