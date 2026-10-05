/**
 * Whether a note's text is still just what a new one starts with: blank lines and the template's own
 * headings (`## Summary`, `## Notes`), nothing typed. Such a page is deleted without asking.
 */
export function isUntouchedBody(body: string, templateBody: string): boolean {
  const headings = new Set(
    templateBody
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
  )
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .every((l) => l === '' || headings.has(l))
}
