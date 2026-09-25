/** Workspaces that can hold notes. Research now; Work later, from the same module code. */
export const NOTE_WORKSPACES = ['research', 'work'] as const
export type NoteWorkspace = (typeof NOTE_WORKSPACES)[number]

/**
 * A note's front matter, as far as the app understands it. Reading is lenient (a hand-edited file never
 * crashes the app); `problems` on the parse result says what was off.
 */
export interface NoteMeta {
  /** '' when the note has no title; it then shows its first line. */
  title: string
  /** '' when the note is ungrouped. */
  group: string
  /** '' when there is none; only ever set together with a group (two levels at most). */
  subgroup: string
  pinned: boolean
  /** YYYY-MM-DD, or '' when missing or malformed. */
  created: string
}

/** Which note: the folder (workspace) and the file's base name, e.g. "Methods participants". */
export interface NoteRef {
  workspace: NoteWorkspace
  id: string
}

/** What the database index holds about one note file. */
export interface NoteIndexRow {
  workspace: NoteWorkspace
  id: string
  title: string
  group: string
  subgroup: string
  pinned: boolean
  created: string
  /** The file's modified time in milliseconds, so edits made in another tool show too. */
  edited: number
  /** The first line of text in the note, without Markdown marks; shown when the note has no title. */
  firstLine: string
  /** Plain text of the whole note, for search and the preview. */
  excerpt: string
  problems: string[]
  contentHash: string
}
