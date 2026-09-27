/** Workspaces that can hold reading lists. Research now; Work later, from the same module code. */
export const READING_LIST_WORKSPACES = ['research', 'work'] as const
export type ReadingListWorkspace = (typeof READING_LIST_WORKSPACES)[number]

/**
 * A list's front matter, as far as the app understands it. Reading is lenient (a hand-edited file
 * never crashes the app); everything else about a list (its sections and entries) lives in the body,
 * parsed by `parseListBody`, not here.
 */
export interface ReadingListMeta {
  /** '' when the list has no title yet; it then shows as "Untitled". */
  title: string
}

/** Which list: the folder (workspace) and the file's base name. */
export interface ReadingListRef {
  workspace: ReadingListWorkspace
  id: string
}

/** What the database index holds about one list file, for the landing page and the all-lists table. */
export interface ReadingListIndexRow {
  workspace: ReadingListWorkspace
  id: string
  title: string
  /** The file's modified time in milliseconds. */
  edited: number
  sectionCount: number
  entryCount: number
  /** Plain text of the whole list, for search. */
  excerpt: string
  contentHash: string
}
