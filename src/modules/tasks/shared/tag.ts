/** A tag is one lower-case word: trimmed, lower-cased, and refused (empty) when it still holds whitespace. */
export function normaliseTag(text: string): string {
  const tag = text.trim().toLowerCase()
  return /\s/u.test(tag) ? '' : tag
}
