import { useEffect, useMemo, useState, type KeyboardEvent, type RefObject } from 'react'
import {
  applyCompletion,
  completionAt,
  modifierAt,
  type ModifierWord,
  type Completion,
  type CompletionOption,
  type UserValues
} from '@shared/search-complete'
import { loadUserValues } from './search-values'

export interface SearchCompletion {
  /** What could finish the word at the caret; null when nothing is offered (or the list was closed with Escape). */
  completion: Completion | null
  /** The highlighted option, or -1. */
  active: number
  /** Where the caret is in the field. */
  caret: number
  /** Tell the hook where the caret is after the field changes or the caret moves. */
  track: (caret: number | null) => void
  /** The `name:value` word the caret is in, for the help row; null elsewhere. */
  typing: ModifierWord | null
  /** The user's own values (people, tags, …). */
  values: UserValues
  /** Put a value in place of the value being typed (a help chip clicked). */
  fill: (insert: string) => void
  /** Insert an option in place of the word. */
  accept: (option: CompletionOption) => void
  /** Call first in the field's key handler; true when the key was used. */
  onKeyDown: (event: KeyboardEvent) => boolean
}

/** The user's own values for the completion list and for telling a person from a stranger, read once when the search opens. */
export function useUserValues(): UserValues {
  const [values, setValues] = useState<UserValues>({})
  useEffect(() => {
    let cancelled = false
    void loadUserValues().then((loaded) => {
      if (!cancelled) setValues(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return values
}

/**
 * The completion list behind a search field: names of modifiers, then the values that exist (`docs/SEARCH_MODIFIERS_PLAN.md`,
 * stage 5). Arrow keys move through the options, Tab or Enter inserts the highlighted one (Tab the first when none is), and
 * Escape closes the list until the word changes. A list of names highlights nothing at first, so Enter still opens a result
 * for a plain word that only looks like the start of a modifier ("with").
 */
export function useSearchCompletion(
  query: string,
  setQuery: (query: string) => void,
  inputRef: RefObject<HTMLInputElement | null>,
  values: UserValues
): SearchCompletion {
  const [caret, setCaret] = useState(0)
  const [closed, setClosed] = useState<string | null>(null)
  const [pick, setPick] = useState<{ key: string | null; index: number }>({ key: null, index: -1 })

  const found = useMemo(
    () => completionAt(query, Math.min(caret, query.length), values),
    [query, caret, values]
  )
  const key = found ? `${found.from}:${query.slice(found.from, found.to)}` : null
  const completion = found && key !== closed ? found : null
  const count = completion?.options.length ?? 0
  const active =
    completion === null
      ? -1
      : pick.key === key
        ? Math.min(pick.index, count - 1)
        : completion.kind === 'value'
          ? 0
          : -1

  const typing = useMemo(() => modifierAt(query, Math.min(caret, query.length)), [query, caret])

  const place = (at: Completion, option: CompletionOption): void => {
    const next = applyCompletion(query, at, option)
    setQuery(next.text)
    setCaret(next.caret)
    // The field has the new text once React has rendered it.
    setTimeout(() => inputRef.current?.setSelectionRange(next.caret, next.caret), 0)
  }

  const accept = (option: CompletionOption): void => {
    if (completion) place(completion, option)
  }

  const fill = (insert: string): void => {
    if (!typing) return
    const at: Completion = { from: typing.from, to: typing.to, kind: 'value', options: [] }
    place(at, { label: insert, insert: `${typing.minus}${typing.modifier}:${insert}` })
    inputRef.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent): boolean => {
    if (!completion) return false
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      const from = active < 0 ? (step === 1 ? -1 : 0) : active
      setPick({ key, index: (from + step + count) % count })
      return true
    }
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault()
      accept(completion.options[Math.max(active, 0)])
      return true
    }
    if (event.key === 'Enter' && active >= 0) {
      event.preventDefault()
      accept(completion.options[active])
      return true
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setClosed(key)
      return true
    }
    return false
  }

  return {
    completion,
    active,
    caret,
    track: (c) => setCaret(c ?? query.length),
    typing,
    values,
    fill,
    accept,
    onKeyDown
  }
}
