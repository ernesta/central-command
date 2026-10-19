import { useState } from 'react'
import { joinQuery, splitChips, type PersonCheck } from '@shared/search-chips'

export interface ChipTextOptions {
  /** Take the last word too, whatever follows it. */
  complete?: boolean
  caret?: number
  /** Keep the text as it is (an input method is composing); the split happens when it ends. */
  raw?: boolean
}

interface ChipQueryState {
  chips: string[]
  text: string
  /** Where the caret goes once the field shows `text`; null leaves it alone. */
  caret: number | null
}

export interface ChipQuery {
  chips: string[]
  /** What is in the field itself, after the chips. */
  text: string
  /** The whole query as the search reads it. */
  query: string
  /** Where the caret should be put after the last change (consumed by the field). */
  caret: number | null
  /** The field's text changed: finished modifiers move out into chips. `complete` takes the last word too (a paste). */
  setText: (text: string, options?: ChipTextOptions) => number
  /** Replace the whole query (a link, `/search <query>`): finished modifiers become chips. */
  setQuery: (query: string) => void
  remove: (index: number) => void
}

/**
 * A search field's state as chips plus text. The query the search reads is always the chips and then the text, so the
 * order the modifiers were typed in is not kept (they combine with AND, so it does not matter).
 */
export function useChipQuery(person: PersonCheck, initial = ''): ChipQuery {
  const [state, setState] = useState<ChipQueryState>(() => ({
    chips: [],
    text: initial,
    caret: initial.length
  }))

  const setText: ChipQuery['setText'] = (text, options = {}) => {
    if (options.raw) {
      setState((prev) => ({ ...prev, text, caret: null }))
      return options.caret ?? text.length
    }
    const split = splitChips(text, { complete: options.complete, caret: options.caret, person })
    setState((prev) => ({
      chips: [...prev.chips, ...split.chips],
      text: split.rest,
      caret: split.caret
    }))
    return split.caret
  }

  const setQuery = (query: string): void => {
    const split = splitChips(query, { complete: true, person })
    setState({ chips: split.chips, text: split.rest, caret: split.rest.length })
  }

  const remove = (index: number): void =>
    setState((prev) => ({ ...prev, chips: prev.chips.filter((_, i) => i !== index), caret: null }))

  return {
    chips: state.chips,
    text: state.text,
    query: joinQuery(state.chips, state.text),
    caret: state.caret,
    setText,
    setQuery,
    remove
  }
}
