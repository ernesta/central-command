import type { TodoItem } from './todos'

/** Workspaces that can hold meetings. Research now; Work later, from the same module code. */
export const MEETING_WORKSPACES = ['research', 'work'] as const
export type MeetingWorkspace = (typeof MEETING_WORKSPACES)[number]

/** The fixed list of series for now. Every meeting has exactly one. */
export const SERIES = ['Supervision', 'Rastle Lab', 'Luminos', 'Other'] as const
export type Series = (typeof SERIES)[number]

export const MEETING_MODES = ['in-person', 'online'] as const
export type MeetingMode = (typeof MEETING_MODES)[number]

/**
 * A meeting's front matter, as far as the app understands it. Reading is lenient (a hand-edited
 * file never crashes the app); `problems` on the parse result says what was off.
 */
export interface MeetingMeta {
  /** Normally one of SERIES; kept as written when it is not, and flagged. */
  series: string
  /** YYYY-MM-DD, or '' when missing or malformed. */
  date: string
  /** 24-hour local time HH:MM, or null. */
  start: string | null
  end: string | null
  mode: MeetingMode | null
  /** Full names, as written. Initials come from the people list. */
  attendees: string[]
  /** Topic headings ticked as discussed. */
  discussed: string[]
}

/** Which meeting: the folder (workspace) and the file's base name, e.g. "2026-09-24 Supervision". */
export interface MeetingRef {
  workspace: MeetingWorkspace
  id: string
}

/** A person from the people list. Initials are unique (case-insensitively). */
export interface Person {
  name: string
  initials: string
  /** The user themselves; at most one. */
  me: boolean
}

/** What the database index holds about one meeting file. */
export interface MeetingIndexRow {
  workspace: MeetingWorkspace
  id: string
  series: string
  date: string
  start: string | null
  end: string | null
  mode: MeetingMode | null
  attendees: string[]
  /** Plain text of the Summary section; '' when empty. */
  summary: string
  /** Plain text of the whole note, for search. */
  excerpt: string
  problems: string[]
  /** How many topics the note has (level-3 headings under Notes, or the fallback headings). */
  topicCount: number
  /** The TODOs found in the note, in order. */
  todos: TodoItem[]
  contentHash: string
}
