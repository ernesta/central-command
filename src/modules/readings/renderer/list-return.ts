/**
 * Remembers which reading was opened from the table, so going back to the list scrolls to it and
 * focuses it instead of starting again at the top. Session memory only, consumed once.
 */
let openedCitekey: string | null = null

export function rememberOpened(citekey: string): void {
  openedCitekey = citekey
}

/** Pure read, safe for a React state initialiser (StrictMode may call it twice). */
export function peekOpened(): string | null {
  return openedCitekey
}

export function clearOpened(): void {
  openedCitekey = null
}
