import { fold } from './text'
import { todayIso } from './time'
import { MODIFIER_NAMES, valueAccepted, type ModifierName } from './search-query'

/** Whether a name or initials is one of the user's people (`with:` and `by:` are chips only for a person who exists). */
export type PersonCheck = (folded: string) => boolean

// A modifier word (optional minus, name, colon, a value or a quoted value), or any other run of non-space text.
const WORD = /(-?)([A-Za-z]+):(?:"([^"]*)("?)|(\S*))|"[^"]*"?|\S+/g

export interface ChipSplit {
  /** The finished `name:value` words, as typed, in order. */
  chips: string[]
  /** What stays plain text in the field: every other word and the word still being typed. */
  rest: string
  /** Where the caret goes in `rest` (clamped; a word taken out before it moves it back). */
  caret: number
}

/**
 * Take the finished modifiers out of the text: a `name:value` word becomes a chip when it is complete and valid and the typist is
 * past it (a space follows, or `complete` says the text ends there: a paste, or Enter). A word still being typed, a modifier with
 * no value, an unknown one, a value the modifier does not take, a person who is nobody in the list, an address, and a quoted value
 * missing its closing quote all stay text. One rule for typing, pasting and picking from the list.
 */
export function splitChips(
  text: string,
  options: { complete?: boolean; caret?: number; person?: PersonCheck; today?: string } = {}
): ChipSplit {
  const { complete = false, person, today = todayIso() } = options
  const caret = options.caret ?? text.length
  const chips: string[] = []
  let rest = ''
  let last = 0
  let moved = 0
  for (const match of text.matchAll(WORD)) {
    const [word, minus, name, quoted, closed, bare] = match
    const end = match.index + word.length
    const terminated = end < text.length || complete
    const value = quoted ?? bare
    const chip =
      terminated &&
      name !== undefined &&
      value !== undefined &&
      isChip(name, value, quoted !== undefined ? closed === '"' : true, person, today)
    if (!chip) continue
    // Drop the word and the one space after it; keep everything else exactly.
    const stop = end < text.length && /\s/.test(text[end]) ? end + 1 : end
    rest += text.slice(last, match.index)
    last = stop
    if (stop <= caret) moved += stop - match.index
    else if (match.index < caret) moved += caret - match.index
    chips.push(minus + word.slice(minus.length))
  }
  rest += text.slice(last)
  return { chips, rest, caret: Math.max(0, Math.min(caret - moved, rest.length)) }
}

function isChip(
  name: string,
  value: string,
  closed: boolean,
  person: PersonCheck | undefined,
  today: string
): boolean {
  const lower = name.toLowerCase()
  if (!(MODIFIER_NAMES as readonly string[]).includes(lower) || !closed) return false
  if (value.startsWith('//') || value.trim() === '') return false
  const folded = fold(value).replace(/\s+/g, ' ').trim()
  if (!valueAccepted(lower as ModifierName, folded, today)) return false
  if (lower === 'with' || lower === 'by') return person?.(folded) === true
  return true
}

/** How a chip reads: the modifier word with its minus, and the value without quotes. */
export function chipLabel(chip: string): string {
  return chip.replace(/"/g, '')
}

/** The query a field and its chips come to: the chips, then the text. */
export function joinQuery(chips: readonly string[], text: string): string {
  return [...chips, text].filter((part) => part.trim() !== '').join(' ')
}

/** The text with a paste put over the selection (line breaks become spaces), and where the caret goes. */
export function insertPaste(
  text: string,
  start: number,
  end: number,
  pasted: string
): { text: string; caret: number } {
  const flat = pasted.replace(/\s*[\r\n]+\s*/g, ' ')
  return { text: text.slice(0, start) + flat + text.slice(end), caret: start + flat.length }
}

/**
 * Whether Backspace takes the last chip out: the caret sits at the very start of the field with nothing selected, a chip is
 * there, and no input method is composing text (the key then belongs to the composition).
 */
export function backspaceRemovesChip(state: {
  chips: number
  selectionStart: number | null
  selectionEnd: number | null
  composing: boolean
}): boolean {
  return (
    state.chips > 0 && !state.composing && state.selectionStart === 0 && state.selectionEnd === 0
  )
}
