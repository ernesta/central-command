import {
  asText,
  isValidDate,
  parseHead,
  readValue,
  splitNote,
  updateHeadKeys,
  type Value
} from '@shared/front-matter'
import { cleanName } from './groups'
import type { NoteMeta } from './types'

export { isValidDate, joinNote, splitNote, type SplitNote } from '@shared/front-matter'

export interface ParsedMeta {
  meta: NoteMeta
  /** What was missing or malformed. Nothing is guessed; the values are just left empty. */
  problems: string[]
}

/** Read the note fields from a note's head (as returned by `splitNote`). A note with no front matter is fine. */
export function parseMeta(head: string): ParsedMeta {
  const problems: string[] = []
  const parsed = parseHead(head)
  const value = (key: string): Value => {
    const entry = parsed?.entries.find((e) => e.key === key)
    return entry ? readValue(entry) : null
  }

  const group = cleanName(asText(value('group')))
  let subgroup = cleanName(asText(value('subgroup')))
  if (subgroup && !group) {
    problems.push('A subgroup without a group')
    subgroup = ''
  }

  const created = asText(value('created')).trim()
  const createdOk = isValidDate(created)
  if (created && !createdOk) problems.push(`Invalid created date: ${created}`)

  return {
    meta: {
      title: asText(value('title')).trim(),
      group,
      subgroup,
      pinned: /^true$/i.test(asText(value('pinned')).trim()),
      created: createdOk ? created : ''
    },
    problems
  }
}

// --- writing ---------------------------------------------------------------------------------

export type MetaPatch = { [K in keyof NoteMeta]?: NoteMeta[K] }

const ORDER: (keyof NoteMeta)[] = ['title', 'group', 'subgroup', 'pinned', 'created']

/**
 * Apply `patch` to a note's head and return the new head. Only the keys in the patch are touched: their
 * lines are replaced in place (or added before the closing fence); every other line, including unknown
 * keys such as `imported-from` and comments, stays exactly as it was. An empty title, group or subgroup
 * and an unpinned note remove the key, and a note with no group loses its subgroup, so the two-level rule
 * holds in every file the app writes. With no front matter yet, a fresh block is created.
 */
export function updateHead(head: string, patch: MetaPatch): string {
  const changes: Record<string, Value> = {}
  for (const key of ORDER) {
    if (!(key in patch)) continue
    const v = patch[key]
    if (key === 'pinned') changes[key] = v ? 'true' : null
    else if (typeof v === 'string') changes[key] = v === '' ? null : v
  }
  const group = 'group' in patch ? (patch.group ?? '') : parseMeta(head).meta.group
  if (!group && ('group' in patch || 'subgroup' in patch)) changes.subgroup = null
  return updateHeadKeys(head, changes, {
    order: ORDER,
    style: (key) => (key === 'created' || key === 'pinned' ? 'plain' : 'auto')
  })
}

/** What a save may change: front matter fields (only those listed) and/or the note body. */
export interface NoteChanges {
  meta?: MetaPatch
  /** The whole new body, replacing the old one exactly as given. */
  body?: string
}

/**
 * The file text after applying `changes` to `text`. Whatever is not being changed is copied through
 * untouched: a body-only change leaves the front matter byte-for-byte alone, and a metadata-only
 * change leaves the body byte-for-byte alone.
 */
export function applyChanges(text: string, changes: NoteChanges): string {
  const { head, body } = splitNote(text)
  const newHead =
    changes.meta && Object.keys(changes.meta).length > 0 ? updateHead(head, changes.meta) : head
  return newHead + (changes.body ?? body)
}

/** The body a new note starts with: empty, so the cursor lands on a blank page. */
export const NEW_NOTE_BODY = ''
