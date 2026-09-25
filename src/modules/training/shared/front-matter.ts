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
import { TRAINING_MODES, type TrainingMeta, type TrainingMode } from './types'

export { isValidDate, joinNote, normaliseTime, splitNote } from '@shared/front-matter'

export interface ParsedTrainingMeta {
  meta: TrainingMeta
  /** What was missing or malformed. Nothing is guessed; the values are just left empty. */
  problems: string[]
}

/** Read the entry fields from a note's head (as returned by `splitNote`). */
export function parseTrainingMeta(head: string): ParsedTrainingMeta {
  const problems: string[] = []
  const parsed = parseHead(head)
  const value = (key: string): Value => {
    const entry = parsed?.entries.find((e) => e.key === key)
    return entry ? readValue(entry) : null
  }
  const text = (key: string): string | null => asText(value(key)).trim() || null
  const list = (key: string): string[] =>
    asList(value(key))
      .map((s) => s.trim())
      .filter(Boolean)
  if (!parsed) problems.push('No front matter')

  const title = text('title') ?? ''
  if (!title) problems.push('Missing title')

  const date = text('date') ?? ''
  const dateOk = isValidDate(date)
  if (!dateOk) problems.push(date ? `Invalid date: ${date}` : 'Missing date')

  const time = (key: 'start' | 'end'): string | null => {
    const raw = text(key)
    if (!raw) return null
    const t = normaliseTime(raw)
    if (!t) problems.push(`Invalid ${key} time: ${raw}`)
    return t
  }

  const modeRaw = text('mode')
  const mode = (TRAINING_MODES as readonly string[]).includes(modeRaw ?? '')
    ? (modeRaw as TrainingMode)
    : null
  if (modeRaw && !mode) problems.push(`Unknown mode: ${modeRaw}`)

  return {
    meta: {
      date: dateOk ? date : '',
      start: time('start'),
      end: time('end'),
      title,
      series: text('series'),
      type: text('type'),
      mode,
      skills: list('skills'),
      leads: list('leads'),
      institution: text('institution'),
      folder: text('folder'),
      organisation: text('organisation'),
      points: text('points'),
      review: text('review')
    },
    problems
  }
}

export type TrainingPatch = { [K in keyof TrainingMeta]?: TrainingMeta[K] }

const ORDER: (keyof TrainingMeta)[] = [
  'date',
  'start',
  'end',
  'title',
  'series',
  'type',
  'mode',
  'skills',
  'leads',
  'institution',
  'folder',
  'organisation',
  'points',
  'review'
]

/**
 * Apply `patch` to a note's head and return the new head. Only the keys in the patch are touched, and
 * every other line (unknown keys, comments) stays exactly as it was. A null value or an empty list
 * removes the key.
 */
export function updateTrainingHead(head: string, patch: TrainingPatch): string {
  return updateHeadKeys(head, patch, {
    order: ORDER,
    style: (key) =>
      key === 'start' || key === 'end'
        ? 'quote'
        : key === 'date' || key === 'points'
          ? 'plain'
          : 'auto'
  })
}

/** What a save may change: front matter fields (only those listed) and/or the note body. */
export interface TrainingChanges {
  meta?: TrainingPatch
  /** The whole new body, replacing the old one exactly as given. */
  body?: string
}

/**
 * The file text after applying `changes` to `text`. Whatever is not being changed is copied through
 * untouched: a body-only change leaves the front matter byte-for-byte alone, and the reverse.
 */
export function applyTrainingChanges(text: string, changes: TrainingChanges): string {
  const { head, body } = splitNote(text)
  const newHead =
    changes.meta && Object.keys(changes.meta).length > 0
      ? updateTrainingHead(head, changes.meta)
      : head
  return newHead + (changes.body ?? body)
}

/** The body a new entry starts with. */
export const NEW_TRAINING_BODY = '## Summary\n\n## Notes\n'
