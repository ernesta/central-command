import { scanLines } from './sections'
import { findMarkers, parseTodos, sameTodo, type TodoItem } from './todos'

const BULLET = /^(\s*)((?:[-*+]|\d+[.)])\s+)?([\s\S]*)$/
const TASK = /^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s/
const NOT_PROSE = /^\s*(?:#{1,6}[ \t]|>|\|)/

/**
 * The checkbox lines a plain-text TODO line becomes (`**TODO(EO)**: text` gives `- [ ] **TODO(EO)**: text`), or null
 * when the line is not one to convert: no TODO marker, already a checkbox, a heading, a quote or a table row. A bullet
 * stays the bullet it was. Several TODOs on one line become a checkbox each, so each can be ticked on its own; anything
 * written before the first marker stays with the first one.
 */
export function todoLineToBoxes(line: string): string[] | null {
  if (TASK.test(line) || NOT_PROSE.test(line)) return null
  const [, indent, bullet, content] = BULLET.exec(line) as RegExpExecArray
  const markers = findMarkers(content)
  if (markers.length === 0) return null
  const lead = `${indent}${bullet?.trimEnd() ?? '-'} [ ] `
  const next = `${indent}${/^\d/.test(bullet ?? '') ? (bullet ?? '-').trimEnd() : '-'} [ ] `
  return markers.map((m, i) => {
    const from = i === 0 ? 0 : m.index
    return (
      (i === 0 ? lead : next) + content.slice(from, markers[i + 1]?.index ?? content.length).trim()
    )
  })
}

export interface ConvertedLine {
  /** 0-based line in the body. */
  line: number
  from: string
  to: string[]
}

/** Every TODO line in a note body written as checkboxes. Fenced code and inline code are left alone. */
export function convertTodoBoxes(body: string): { body: string; converted: ConvertedLine[] } {
  const eol = body.includes('\r\n') ? '\r\n' : '\n'
  const converted: ConvertedLine[] = []
  let out = ''
  let cursor = 0
  scanLines(body).forEach((l, line) => {
    if (l.inFence) return
    const to = todoLineToBoxes(l.text)
    if (!to) return
    converted.push({ line, from: l.text, to })
    out += body.slice(cursor, l.start) + to.join(eol)
    cursor = l.start + l.text.length
  })
  return { body: out + body.slice(cursor), converted }
}

const key = (t: Pick<TodoItem, 'owners' | 'text'>): string => `${t.owners.join('&')}|${t.text}`

/**
 * What is wrong with a conversion, if anything: the TODOs (owners and text, in order) must read back the same, none may be
 * ticked that was not, and every line that was not converted must be identical.
 */
export function checkTodoConversion(before: string, after: string): string[] {
  const problems: string[] = []
  const a = parseTodos(before)
  const b = parseTodos(after)
  if (a.length !== b.length || a.some((t, i) => key(t) !== key(b[i]))) {
    problems.push('the TODOs read back differently')
  }
  if (b.filter((t) => t.done).length !== a.filter((t) => t.done).length) {
    problems.push('the number of ticked boxes changed')
  }
  const kept = new Set(scanLines(after).map((l) => l.text))
  if (
    scanLines(before).some(
      (l) => (l.inFence || todoLineToBoxes(l.text) === null) && !kept.has(l.text)
    )
  )
    problems.push('a line that was not a TODO changed')
  return problems
}

/**
 * Tick the TODO `todo` in a note body: every unticked item that is the same TODO (as in the open list, where repeats are
 * shown once). A TODO written as plain text becomes a checkbox first. Only those lines change. Null when nothing matches
 * (the note changed since the list was made).
 */
export function tickTodo(body: string, todo: Pick<TodoItem, 'owners' | 'text'>): string | null {
  const lines = scanLines(body)
  const eol = body.includes('\r\n') ? '\r\n' : '\n'
  const hits = [
    ...new Set(
      parseTodos(body)
        .filter((t) => !t.done && sameTodo(t, todo))
        .map((t) => t.line)
    )
  ].sort((x, y) => y - x)
  if (hits.length === 0) return null
  let out = body
  for (const index of hits) {
    const l = lines[index]
    if (TASK.test(l.text)) {
      out =
        out.slice(0, l.start) + l.text.replace('[ ]', '[x]') + out.slice(l.start + l.text.length)
      continue
    }
    const boxes = todoLineToBoxes(l.text) ?? [l.text]
    const ticked = boxes.map((text) =>
      parseTodos(text).some((t) => !t.done && sameTodo(t, todo))
        ? text.replace(/\[ \]/, '[x]')
        : text
    )
    out = out.slice(0, l.start) + ticked.join(eol) + out.slice(l.start + l.text.length)
  }
  return out
}
