import { formatTodoLine, parseTodos, sameTodo, type TodoItem } from './todos'
import { parseHeading, scan } from './sections'

export interface MeetingKey {
  workspace?: string
  id: string
  series: string
  /** YYYY-MM-DD, or '' when unknown. */
  date: string
}

const before = (a: MeetingKey, b: MeetingKey): boolean =>
  a.date < b.date || (a.date === b.date && a.id < b.id)

/**
 * The meeting before `current` in the same series: the latest one with an earlier date (or, on the
 * same day, an earlier id, so `… Supervision` comes before `… Supervision 2`). Meetings without a
 * date are never a previous meeting.
 */
export function findPreviousMeeting<T extends MeetingKey>(
  all: readonly T[],
  current: MeetingKey
): T | null {
  if (!current.date) return null
  let best: T | null = null
  for (const m of all) {
    if (m.id === current.id || m.series !== current.series || !m.date) continue
    if (
      m.workspace !== undefined &&
      current.workspace !== undefined &&
      m.workspace !== current.workspace
    )
      continue
    if (!before(m, current)) continue
    if (best === null || before(best, m)) best = m
  }
  return best
}

/**
 * The TODOs to carry from the previous meeting into the current one: the previous meeting's inline
 * TODOs plus its unticked Previous TODOs, minus anything the current meeting's Previous TODOs
 * already lists (ticked or not) and minus repeats within the list itself. Ticked items are never
 * carried. Order: the previous note's own order.
 */
export function todosToCarry(
  previous: readonly TodoItem[],
  currentTodos: readonly TodoItem[]
): TodoItem[] {
  const existing = currentTodos.filter((t) => t.kind === 'previous')
  const out: TodoItem[] = []
  for (const t of previous) {
    if (t.done) continue
    if (existing.some((e) => sameTodo(e, t))) continue
    if (out.some((o) => sameTodo(o, t))) continue
    out.push(t)
  }
  return out
}

const PREVIOUS_TODOS = 'previous todos'

/**
 * Add `items` as unticked checkboxes at the end of the `## Previous TODOs` section of `body`,
 * creating the section (before `## Notes`, else at the end) when it is missing. This only inserts:
 * every existing character stays where it was, so removing the added lines gives back the original.
 * Line endings follow the note.
 */
export function insertPreviousTodos(
  body: string,
  items: readonly Pick<TodoItem, 'owners' | 'text'>[]
): string {
  if (items.length === 0) return body
  const eol = body.includes('\r\n') ? '\r\n' : '\n'
  const block = items.map((i) => formatTodoLine(i)).join(eol)
  const { lines, unclosedFenceAt } = scan(body)
  // An unclosed code fence swallows the rest of the note; nothing may be inserted inside it.
  const limit = unclosedFenceAt ?? lines.length
  const lineEnd = (i: number): number => (i + 1 < lines.length ? lines[i + 1].start : body.length)
  const headings = lines.flatMap((l, i) => {
    const h = l.inFence ? null : parseHeading(l.text)
    return h ? [{ ...h, i }] : []
  })

  const at = headings.findIndex((h) => h.level === 2 && h.text.toLowerCase() === PREVIOUS_TODOS)
  if (at !== -1) {
    const start = headings[at].i
    const next = headings.slice(at + 1).find((h) => h.level <= 2)
    const stop = Math.min(next ? next.i : lines.length, limit)
    let last = -1
    for (let i = start + 1; i < stop; i++) if (lines[i].text.trim() !== '') last = i
    if (last !== -1)
      return spliceLines(body, lineEnd(last), block, eol, lineEnd(last) === body.length)
    // Empty section: the items go after a blank line under the heading.
    const pos = lineEnd(start)
    const following = lines[start + 1]
    const lead = pos === body.length && !body.endsWith('\n') ? eol : ''
    const trail = following !== undefined && following.text.trim() !== '' ? eol : ''
    return body.slice(0, pos) + lead + eol + block + eol + trail + body.slice(pos)
  }

  const notes = headings.find(
    (h) => h.level === 2 && h.text.toLowerCase() === 'notes' && h.i < limit
  )
  const section = `## Previous TODOs${eol}${eol}${block}${eol}${eol}`
  if (notes) return body.slice(0, lines[notes.i].start) + section + body.slice(lines[notes.i].start)
  if (unclosedFenceAt !== null) {
    const pos = lines[unclosedFenceAt].start
    return body.slice(0, pos) + section + body.slice(pos)
  }
  const endsBlank = /\n[ \t]*\r?\n$/.test(body)
  const sep = body === '' || endsBlank ? '' : body.endsWith('\n') ? eol : eol + eol
  return body + sep + section.trimEnd() + eol
}

function spliceLines(
  body: string,
  pos: number,
  block: string,
  eol: string,
  atEnd: boolean
): string {
  const lead = atEnd && !body.endsWith('\n') ? eol : ''
  return body.slice(0, pos) + lead + block + eol + body.slice(pos)
}

export interface CarryOverResult {
  /** The body after the sync (unchanged when nothing was missing). */
  body: string
  /** What was added. */
  added: TodoItem[]
}

/**
 * Sync a meeting's Previous TODOs from the previous meeting's note: parse both, work out what is
 * missing and insert it. Adds only; never removes or edits an item and never touches ticked state.
 */
export function carryOver(previousBody: string, currentBody: string): CarryOverResult {
  const added = todosToCarry(parseTodos(previousBody), parseTodos(currentBody))
  return { body: insertPreviousTodos(currentBody, added), added }
}
