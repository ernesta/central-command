import { fold } from './text'
import { MODIFIER_NAMES, modifierValues, quoteValue, type ModifierName } from './search-query'

export interface CompletionOption {
  /** Shown. */
  label: string
  /** Typed in place of the word being completed. */
  insert: string
  /** A few words beside it. */
  hint?: string
}

/** The word under the caret and what could finish it. */
export interface Completion {
  /** The stretch of the text the choice replaces. */
  from: number
  to: number
  /** `name` completes the modifier's name, `value` what comes after its colon. */
  kind: 'name' | 'value'
  /** The modifier whose value is being completed. */
  modifier?: ModifierName
  options: CompletionOption[]
}

const HINTS: Record<ModifierName, string> = {
  in: 'one kind of item',
  workspace: 'one workspace',
  with: 'a person',
  by: 'author or lead',
  status: 'task or reading',
  priority: 'tasks',
  due: 'tasks',
  list: 'tasks',
  tag: 'tasks, readings',
  skill: 'training, meetings',
  series: 'meetings, training',
  has: 'it has this',
  before: 'a date',
  after: 'a date',
  on: 'a date',
  during: 'a period'
}

/** The values to offer that come from the user's own data, by modifier. */
export type UserValues = Partial<Record<ModifierName, readonly CompletionOption[]>>

const MAX_OPTIONS = 8
const MIN_NAME_LETTERS = 2

/** Dates and periods that can be typed without a number. */
const DAY_WORDS = ['today', 'yesterday']
const PERIOD_WORDS = [
  'today',
  'yesterday',
  'this week',
  'last week',
  'this month',
  'last month',
  'this year',
  'last year'
]

function fixedOptions(name: ModifierName): CompletionOption[] {
  const words =
    name === 'before' || name === 'after' || name === 'on'
      ? DAY_WORDS
      : name === 'during'
        ? PERIOD_WORDS
        : modifierValues(name)
  return words.map((w) => ({ label: w, insert: quoteValue(w) }))
}

/** The start of the word the caret is in: after the last space that is not inside quotes. */
function wordStart(text: string, caret: number): number {
  let quoted = false
  let start = 0
  for (let i = 0; i < caret; i++) {
    if (text[i] === '"') quoted = !quoted
    else if (/\s/.test(text[i]) && !quoted) start = i + 1
  }
  return start
}

function rank(options: readonly CompletionOption[], typed: string): CompletionOption[] {
  const wanted = fold(typed)
  const labels = (o: CompletionOption): string => fold(o.label)
  const starts = options.filter((o) => labels(o).startsWith(wanted))
  const inside = options.filter((o) => !labels(o).startsWith(wanted) && labels(o).includes(wanted))
  return [...starts, ...inside]
}

/**
 * What could finish the word at `caret`: a modifier's name (two letters in, or after a minus), or the value after `name:` from
 * the fixed lists and the user's own data. Null when there is nothing to offer, including when the value is already complete.
 */
export function completionAt(
  text: string,
  caret: number,
  userValues: UserValues = {}
): Completion | null {
  const from = wordStart(text, caret)
  let to = caret
  while (to < text.length && !/\s/.test(text[to])) to++
  const word = text.slice(from, caret)
  const match = /^(-?)([A-Za-z]*)(?::(.*))?$/s.exec(word)
  if (!match) return null
  const [, minus, name, rawValue] = match

  if (rawValue === undefined) {
    if (name.length < MIN_NAME_LETTERS && !(minus && name.length > 0)) return null
    const options = MODIFIER_NAMES.filter((n) => n.startsWith(name.toLowerCase())).map((n) => ({
      label: `${n}:`,
      insert: `${minus}${n}:`,
      hint: HINTS[n]
    }))
    if (options.length === 0) return null
    return { from, to, kind: 'name', options: options.slice(0, MAX_OPTIONS) }
  }

  const modifier = name.toLowerCase()
  if (!(MODIFIER_NAMES as readonly string[]).includes(modifier)) return null
  const key = modifier as ModifierName
  const known = [...fixedOptions(key), ...(userValues[key] ?? [])]
  const typed = rawValue.replace(/^"/, '').replace(/"$/, '')
  const options = rank(known, typed)
    .slice(0, MAX_OPTIONS)
    .map((o) => ({ ...o, insert: `${minus}${key}:${o.insert}` }))
  if (options.length === 0) return null
  // The word already says it all: no list left to open.
  if (options.length === 1 && fold(options[0].label) === fold(typed) && typed !== '') return null
  return { from, to, kind: 'value', modifier: key, options }
}

/** The text with the chosen option in place of the word, and where the caret goes (after a space, ready for the next word). */
export function applyCompletion(
  text: string,
  completion: Completion,
  option: CompletionOption
): { text: string; caret: number } {
  const after = text.slice(completion.to)
  const insert = completion.kind === 'value' ? `${option.insert} ` : option.insert
  const rest = completion.kind === 'value' && after.startsWith(' ') ? after.slice(1) : after
  const next = `${text.slice(0, completion.from)}${insert}${rest}`
  return { text: next, caret: completion.from + insert.length }
}
