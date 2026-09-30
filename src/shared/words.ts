import { markdownToExcerpt } from '@shared/text'

/**
 * Marks that appear in the text as typed (the live editor's text is the file's own Markdown) and that the excerpt does not
 * remove: every level of `>` in front of a line, closing `##` on a heading, an empty heading, a setext `===` underline, and
 * backslash escapes (`\*`, and the `\` that ends a line).
 */
function typedMarkdown(markdown: string): string {
  return (
    markdown
      // The editor writes a bare link as `<https://…>`, which the excerpt would drop as HTML: keep it as one word.
      .replace(/<(https?:\/\/[^>\s]+)>/g, '$1')
      .replace(/^[ \t]*(?:>[ \t]?)+/gm, '')
      .replace(/^([ \t]{0,3}#{1,6}[ \t].*?)[ \t]+#+[ \t]*$/gm, '$1')
      .replace(/^[ \t]{0,3}#{1,6}[ \t]*$/gm, '')
      .replace(/^[ \t]{0,3}=+[ \t]*$/gm, '')
      .replace(/\\$/gm, '')
      .replace(/\\([!-/:-@[-`{-~])/g, '$1')
  )
}

/** The words of a note's text, not counting Markdown marks (`##`, `**`, list bullets, link addresses). */
export function wordsOf(markdown: string): string[] {
  const text = markdownToExcerpt(typedMarkdown(markdown), Number.MAX_SAFE_INTEGER)
  return text === '' ? [] : text.split(/\s+/)
}

/** How many words a note's text has, not counting Markdown marks (`##`, `**`, list bullets, link addresses). */
export function wordCount(markdown: string): number {
  return wordsOf(markdown).length
}

/** "412 words", "1 word". */
export function wordCountLabel(count: number): string {
  return `${count.toLocaleString('en-GB')} ${count === 1 ? 'word' : 'words'}`
}
