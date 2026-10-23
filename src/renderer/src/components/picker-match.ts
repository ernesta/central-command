import { fold } from '@shared/text'

/** A list with more options than this opens with a search field; a shorter one is a plain list. */
export const PICKER_SEARCH_MIN = 7

export interface PickerOption<T extends string = string> {
  value: T
  label: string
  /** A quiet second line under the label. */
  description?: string
  /** Options with the same group are listed together under its name. */
  group?: string
  /** More words the search looks in; never shown. */
  keywords?: string
  /** Drawn indented, as a sub-item of the option above. */
  nested?: boolean
}

/** Whether a list of this many options opens with a search field. */
export function hasSearch(count: number, always = false): boolean {
  return always || count > PICKER_SEARCH_MIN
}

/** Listed the way the native select lists them: ungrouped first, then each group in the order it first appears. */
export function orderOptions<T extends string>(
  options: readonly PickerOption<T>[]
): PickerOption<T>[] {
  const groups = [...new Set(options.flatMap((o) => (o.group ? [o.group] : [])))]
  return [
    ...options.filter((o) => !o.group),
    ...groups.flatMap((g) => options.filter((o) => o.group === g))
  ]
}

/** The words typed, folded: case and accents do not matter. */
export function queryTerms(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean)
}

/** The options (in listed order) whose label, description or keywords hold every word typed. */
export function matchOptions<T extends string>(
  options: readonly PickerOption<T>[],
  query: string
): PickerOption<T>[] {
  const ordered = orderOptions(options)
  const terms = queryTerms(query)
  if (terms.length === 0) return ordered
  return ordered.filter((o) => {
    const text = fold(`${o.label} ${o.description ?? ''} ${o.keywords ?? ''}`)
    return terms.every((t) => text.includes(t))
  })
}

/** Where the words typed sit in a label (start and end, in the label's own characters), for highlighting. */
export function highlightRanges(label: string, query: string): [number, number][] {
  const terms = queryTerms(query)
  if (terms.length === 0) return []
  // Folding can change the length ("ß" is "ss", an accent is nothing), so keep where each folded character came from.
  let folded = ''
  const origin: number[] = []
  let at = 0
  for (const char of label) {
    const piece = fold(char)
    for (let i = 0; i < piece.length; i++) origin.push(at)
    folded += piece
    at += char.length
  }
  const ranges: [number, number][] = []
  for (const term of terms) {
    for (
      let from = folded.indexOf(term);
      from >= 0;
      from = folded.indexOf(term, from + term.length)
    ) {
      const last = from + term.length - 1
      const lastChar = origin[last]
      const lastLength = [...label.slice(lastChar)][0].length
      ranges.push([origin[from], lastChar + lastLength])
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const range of ranges) {
    const previous = merged[merged.length - 1]
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1])
    else merged.push([...range])
  }
  return merged
}

/** The index of the first option whose label starts with what was typed (type-ahead on a list with no search field). */
export function typeAhead(options: readonly PickerOption[], typed: string): number {
  const text = fold(typed).trimStart()
  if (!text) return -1
  return options.findIndex((o) => fold(o.label).startsWith(text))
}

/** Whether the text is exactly an option's label (so there is nothing new to add). */
export function hasExactMatch(options: readonly PickerOption[], text: string): boolean {
  const wanted = fold(text.trim())
  return options.some((o) => fold(o.label.trim()) === wanted)
}

/**
 * Which row starts highlighted. Nothing typed: the current value, if the list shows it. Something typed: the exact
 * match, else (with an "Add" row) the only match or the Add row, else the first match. The Add row is the row after
 * the matches.
 */
export function defaultActive(
  matches: readonly PickerOption[],
  text: string,
  options: { selected?: string | null; addRow: boolean }
): number {
  if (text.trim() === '') {
    const at = matches.findIndex((o) => o.value === options.selected)
    return at
  }
  const wanted = fold(text.trim())
  const exact = matches.findIndex((o) => fold(o.label.trim()) === wanted)
  if (exact >= 0) return exact
  if (options.addRow) return matches.length === 1 ? 0 : matches.length
  return matches.length > 0 ? 0 : -1
}

/**
 * The options of a field whose values are free text (Series, Institution): the values already used, once each and
 * sorted, with the current one among them, and a row that clears it when there is a word for none.
 */
export function usedValueOptions(
  used: readonly string[],
  current: string,
  none?: string
): PickerOption[] {
  const values = [...new Set([...used, current].map((v) => v.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b)
  )
  return [
    ...(none ? [{ value: '', label: none }] : []),
    ...values.map((value) => ({ value, label: value }))
  ]
}
