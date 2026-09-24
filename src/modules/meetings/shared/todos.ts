import { findByInitials, findByName } from './people'
import { parseHeading, scanLines } from './sections'
import type { Person } from './types'

export type TodoKind = 'inline' | 'previous'

/** One TODO found in a note. */
export interface TodoItem {
  /** 'previous' for a checkbox item under `## Previous TODOs`; 'inline' for a TODO written anywhere else. */
  kind: TodoKind
  /** Owner initials, upper-cased, in the order written. Empty when the TODO names nobody. */
  owners: string[]
  /** The TODO text exactly as written (trimmed), Markdown included. */
  text: string
  /** Ticked. Only checkbox items can be ticked. */
  done: boolean
  /** 0-based index of the line in the body. */
  line: number
}

/** `**TODO(EO)**:`, `**TODO(EO):**`, `**TODO**:`, `TODO(EO):`, `TODO (EO):`, `TODO:` and the multi-owner forms. */
const MARKER =
  /(?<![\p{L}\p{N}_*])(?:\*\*TODO\s*(?:\(([^()]*)\))?\s*(?:\*\*\s*:|:\s*\*\*)|TODO\s*(?:\(([^()]*)\))?\s*:)/gu
const TASK = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.*)$/
const OWNER_SEPARATOR = /\s*(?:&|,|\+|\/|\band\b)\s*/i

/** Owner initials from what is inside the brackets: "KR & AC" gives ['KR', 'AC']. */
export function parseOwners(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(OWNER_SEPARATOR)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
}

/** Character ranges of inline code spans, where a TODO is only being talked about, not written. */
function codeSpans(line: string): [number, number][] {
  const spans: [number, number][] = []
  const re = /(`+)(?:(?!\1)[\s\S])*?\1/g
  for (let m = re.exec(line); m; m = re.exec(line)) spans.push([m.index, m.index + m[0].length])
  return spans
}

interface Marker {
  index: number
  end: number
  owners: string[]
}

function findMarkers(line: string): Marker[] {
  const spans = codeSpans(line)
  const found: Marker[] = []
  for (const m of line.matchAll(MARKER)) {
    const index = m.index ?? 0
    if (spans.some(([a, b]) => index >= a && index < b)) continue
    found.push({ index, end: index + m[0].length, owners: parseOwners(m[1] ?? m[2]) })
  }
  return found
}

/** The TODO texts on one line: each marker owns the text up to the next marker. */
function inlineOnLine(line: string): { owners: string[]; text: string }[] {
  const markers = findMarkers(line)
  return markers
    .map((m, i) => ({
      owners: m.owners,
      text: line.slice(m.end, markers[i + 1]?.index ?? line.length).trim()
    }))
    .filter((t) => t.text !== '')
}

/**
 * Every TODO in a note body, in order. Fenced code and inline code are ignored. Under
 * `## Previous TODOs`, each checkbox item is one 'previous' TODO (with or without the TODO syntax);
 * everything else that is written in the TODO syntax is 'inline'. A checkbox item that is ticked
 * anywhere is `done`.
 */
export function parseTodos(body: string): TodoItem[] {
  const items: TodoItem[] = []
  let inPrevious = false
  scanLines(body).forEach((l, line) => {
    if (l.inFence) return
    const title = parseHeading(l.text)
    if (title && title.level <= 2) {
      inPrevious = title.level === 2 && title.text.toLowerCase() === 'previous todos'
    }
    const task = TASK.exec(l.text)
    const done = task ? task[1] !== ' ' : false
    const content = task ? task[2] : l.text

    if (inPrevious && task) {
      const first = findMarkers(content)[0]
      if (first && content.slice(0, first.index).trim() === '') {
        const text = inlineOnLine(content)[0]?.text
        if (text) items.push({ kind: 'previous', owners: first.owners, text, done, line })
      } else if (content.trim() !== '') {
        items.push({ kind: 'previous', owners: [], text: content.trim(), done, line })
      }
      return
    }
    for (const t of inlineOnLine(content)) items.push({ kind: 'inline', ...t, done, line })
  })
  return items
}

/** Text compared without formatting noise: case, emphasis marks, spacing and a final full stop. */
export function normaliseTodoText(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;,]+$/, '')
    .trim()
}

const ownersKey = (owners: readonly string[]): string => [...owners].sort().join('&')

/**
 * Whether two TODOs are the same one: same text once normalised, and the same owners. A TODO with
 * no owner (an old plain checkbox) matches any owner, so importing does not double up items.
 */
export function sameTodo(
  a: Pick<TodoItem, 'owners' | 'text'>,
  b: Pick<TodoItem, 'owners' | 'text'>
): boolean {
  if (normaliseTodoText(a.text) !== normaliseTodoText(b.text)) return false
  return (
    a.owners.length === 0 || b.owners.length === 0 || ownersKey(a.owners) === ownersKey(b.owners)
  )
}

/** The checkbox line for a carried-over TODO: `- [ ] **TODO(EO)**: text`. */
export function formatTodoLine(item: Pick<TodoItem, 'owners' | 'text'>): string {
  const owners = item.owners.length ? `(${item.owners.join(' & ')})` : ''
  return `- [ ] **TODO${owners}**: ${item.text}`
}

export interface ResolvedOwner {
  initials: string
  person: Person | null
  /** Where the person was found; 'unknown' is kept and flagged, never dropped. */
  source: 'attendee' | 'people' | 'unknown'
}

/** Resolve an owner's initials against the meeting's attendees first, then everyone in the people list. */
export function resolveOwner(
  initials: string,
  attendeeNames: readonly string[],
  people: readonly Person[]
): ResolvedOwner {
  const attendees = attendeeNames
    .map((name) => findByName(people, name))
    .filter((p): p is Person => p !== undefined)
  const attendee = findByInitials(attendees, initials)
  if (attendee) return { initials, person: attendee, source: 'attendee' }
  const anyone = findByInitials(people, initials)
  if (anyone) return { initials, person: anyone, source: 'people' }
  return { initials, person: null, source: 'unknown' }
}

/** Whether a TODO belongs to the person with these initials (owners may be several). */
export function ownedBy(item: Pick<TodoItem, 'owners'>, initials: string): boolean {
  const wanted = initials.trim().toUpperCase()
  return wanted !== '' && item.owners.includes(wanted)
}
