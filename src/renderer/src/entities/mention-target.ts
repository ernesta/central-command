import type { EntityRef } from '@shared/entities'
import type { CopyPart } from '@shared/entity-copy'
import type { Resolved } from './resolver'

/** The `@…` being typed: where it starts (the `@`), where the cursor is, and what follows the `@`. */
export interface Suggestion {
  from: number
  to: number
  query: string
}

/**
 * What the `@` picker needs from an editor, so `EntityPickerController` does not know which library the editor is
 * made with (`liveTarget`).
 */
export interface MentionTarget {
  /** Where a position is on the screen (viewport pixels). */
  coordsAt(pos: number): { left: number; bottom: number }
  /** Draw the mentions again: something they point at has been looked up. */
  refresh(): void
  /** The `@…` the cursor is at the end of now, or null. */
  current(): Suggestion | null
  /** Replace the `@…` with a mention of `ref` labelled `label`, followed by a space, and put the cursor after it. */
  insert(suggestion: Suggestion, label: string, ref: EntityRef): void
}

/**
 * Everything the editors need from the outside world: what a mention points at, and the picker that opens on `@`.
 * A controller object, not React state, so the editor never sees a stale closure (the same shape as the find bar's bridge).
 */
export interface EntityHost {
  resolve(ref: EntityRef): Resolved
  /** The text before the cursor now ends in an `@…` (or no longer does: null). */
  suggest(target: MentionTarget, suggestion: Suggestion | null): void
  /** A key went down while the picker may be open; true when the picker took it. */
  handleKey(event: KeyboardEvent): boolean
  /** What a mention reads as outside the app; null when it is just its label (or the kind has nothing to add). */
  copyPart(ref: EntityRef, label: string): Promise<CopyPart | null>
  /** The editor is gone (a reload from disk, or React StrictMode's throwaway first mount). */
  detach(): void
}

const MAX_QUERY = 30
// An `@` that starts a word (after a space, an opening bracket or the start of the block), then a query whose first
// character is not a space, so "meet @ noon" is only a sentence.
const TRIGGER = /(?:^|[\s([{"“‘])@([^\s@][^@\n]*)?$/

/**
 * The `@…` a run of text (a block's or line's text up to the cursor) ends in: the query, and where the `@` is in the
 * text. Null when there is none, or once the query has run on (more than a short phrase, or two spaces in a row).
 */
export function suggestionIn(before: string): { query: string; at: number } | null {
  const match = TRIGGER.exec(before)
  if (!match) return null
  const query = match[1] ?? ''
  if (query.length > MAX_QUERY || /\s\s/.test(query)) return null
  return { query, at: before.length - query.length - 1 }
}
