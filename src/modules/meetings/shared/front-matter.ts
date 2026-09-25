import { MEETING_MODES, type MeetingMeta, type MeetingMode } from './types'
import {
  asList,
  asText,
  isValidDate,
  normaliseTime,
  parseHead,
  readValue,
  splitNote,
  updateHeadKeys,
  type Value
} from '@shared/front-matter'

export {
  isValidDate,
  joinNote,
  normaliseTime,
  splitNote,
  type SplitNote
} from '@shared/front-matter'

export interface ParsedMeta {
  meta: MeetingMeta
  /** What was missing or malformed. Nothing is guessed; the values are just left empty. */
  problems: string[]
}

/** Read the meeting fields from a note's head (as returned by `splitNote`). */
export function parseMeta(head: string): ParsedMeta {
  const problems: string[] = []
  const parsed = parseHead(head)
  const value = (key: string): Value => {
    const entry = parsed?.entries.find((e) => e.key === key)
    return entry ? readValue(entry) : null
  }
  if (!parsed) problems.push('No front matter')

  const series = asText(value('series')).trim()
  if (!series) problems.push('Missing series')

  const date = asText(value('date')).trim()
  const dateOk = isValidDate(date)
  if (!dateOk) problems.push(date ? `Invalid date: ${date}` : 'Missing date')

  const time = (key: 'start' | 'end'): string | null => {
    const raw = asText(value(key)).trim()
    if (!raw) return null
    const t = normaliseTime(raw)
    if (!t) problems.push(`Invalid ${key} time: ${raw}`)
    return t
  }

  const start = time('start')
  const end = time('end')

  const modeRaw = asText(value('mode')).trim()
  const mode = (MEETING_MODES as readonly string[]).includes(modeRaw)
    ? (modeRaw as MeetingMode)
    : null
  if (modeRaw && !mode) problems.push(`Unknown mode: ${modeRaw}`)

  return {
    meta: {
      series,
      date: dateOk ? date : '',
      start,
      end,
      mode,
      attendees: asList(value('attendees'))
        .map((s) => s.trim())
        .filter(Boolean),
      discussed: asList(value('discussed'))
        .map((s) => s.trim())
        .filter(Boolean),
      skills: asList(value('skills'))
        .map((s) => s.trim())
        .filter(Boolean)
    },
    problems
  }
}

// --- writing ---------------------------------------------------------------------------------
// --- writing ---------------------------------------------------------------------------------

export type MetaPatch = { [K in keyof MeetingMeta]?: MeetingMeta[K] }

const ORDER: (keyof MeetingMeta)[] = [
  'series',
  'date',
  'start',
  'end',
  'mode',
  'attendees',
  'skills',
  'discussed'
]

/**
 * Apply `patch` to a note's head and return the new head. Only the keys in the patch are touched:
 * their lines are replaced in place (or added before the closing fence); every other line, including
 * unknown keys and comments, stays exactly as it was. A null start or end, an empty `discussed` and a
 * null mode remove the key. With no front matter yet, a fresh block is created.
 */
export function updateHead(head: string, patch: MetaPatch): string {
  return updateHeadKeys(head, patch, {
    order: ORDER,
    style: (key) =>
      key === 'start' || key === 'end' ? 'quote' : key === 'date' ? 'plain' : 'auto',
    keepEmptyList: ['attendees']
  })
}

/** What a save may change: front matter fields (only those listed) and/or the note body. */
export interface MeetingChanges {
  meta?: MetaPatch
  /** The whole new body, replacing the old one exactly as given. */
  body?: string
}

/**
 * The file text after applying `changes` to `text`. Whatever is not being changed is copied through
 * untouched: a body-only change leaves the front matter byte-for-byte alone, and a metadata-only
 * change leaves the body byte-for-byte alone.
 */
export function applyChanges(text: string, changes: MeetingChanges): string {
  const { head, body } = splitNote(text)
  const newHead =
    changes.meta && Object.keys(changes.meta).length > 0 ? updateHead(head, changes.meta) : head
  return newHead + (changes.body ?? body)
}

/** The body a new meeting starts with. */
export const NEW_MEETING_BODY = '## Summary\n\n## Previous TODOs\n\n## Notes\n'
