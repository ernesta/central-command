import {
  asText,
  parseHead,
  readValue,
  splitNote,
  updateHeadKeys,
  type Value
} from '@shared/front-matter'
import type { ReadingListMeta } from './types'

export { joinNote, splitNote, type SplitNote } from '@shared/front-matter'

export interface ParsedMeta {
  meta: ReadingListMeta
  /** What was missing or malformed. Nothing is guessed; the values are just left empty. */
  problems: string[]
}

/** Read a list's fields from its head (as returned by `splitNote`). A list with no front matter is fine. */
export function parseMeta(head: string): ParsedMeta {
  const parsed = parseHead(head)
  const value = (key: string): Value => {
    const entry = parsed?.entries.find((e) => e.key === key)
    return entry ? readValue(entry) : null
  }
  return { meta: { title: asText(value('title')).trim() }, problems: [] }
}

// --- writing ---------------------------------------------------------------------------------

export type MetaPatch = { [K in keyof ReadingListMeta]?: ReadingListMeta[K] }

const ORDER: (keyof ReadingListMeta)[] = ['title']

/** Apply `patch` to a list's head and return the new head, the same rules `updateHeadKeys` gives every module. */
export function updateHead(head: string, patch: MetaPatch): string {
  const changes: Record<string, Value> = {}
  if ('title' in patch) changes.title = patch.title === '' ? null : (patch.title ?? null)
  return updateHeadKeys(head, changes, { order: ORDER })
}

/** What a save may change: front matter fields (only those listed) and/or the list body. */
export interface ListChanges {
  meta?: MetaPatch
  /** The whole new body, replacing the old one exactly as given. */
  body?: string
}

/**
 * The file text after applying `changes` to `text`. Whatever is not being changed is copied through
 * untouched: a body-only change leaves the front matter byte-for-byte alone, and a metadata-only
 * change leaves the body byte-for-byte alone.
 */
export function applyChanges(text: string, changes: ListChanges): string {
  const { head, body } = splitNote(text)
  const newHead =
    changes.meta && Object.keys(changes.meta).length > 0 ? updateHead(head, changes.meta) : head
  return newHead + (changes.body ?? body)
}

/** The body a new list starts with: empty, so the cursor lands on a blank page. */
export const NEW_LIST_BODY = ''
