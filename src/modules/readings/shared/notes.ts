/** A reading's notes file as read from disk. A missing file and an empty one look the same. */
export interface NoteContent {
  exists: boolean
  content: string
  /** Hash of `content`; the editor sends it back to prove which version it started from. */
  hash: string
}

export type NoteWriteResult =
  | { status: 'saved'; hash: string }
  /** The file changed since the editor loaded it; nothing was written. */
  | { status: 'conflict'; disk: NoteContent }

/** Pushed to the renderer when a notes file changes on disk (from any tool, including this app). */
export interface NoteChangedEvent {
  citekey: string
  hash: string
}
