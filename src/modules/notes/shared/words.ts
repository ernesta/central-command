import { markdownToExcerpt } from '@shared/text'

/** How many words a note's text has, not counting Markdown marks (`##`, `**`, list bullets, link addresses). */
export function wordCount(markdown: string): number {
  const text = markdownToExcerpt(markdown, Number.MAX_SAFE_INTEGER)
  return text === '' ? 0 : text.split(/\s+/).length
}

/** "412 words", "1 word". */
export function wordCountLabel(count: number): string {
  return `${count.toLocaleString('en-GB')} ${count === 1 ? 'word' : 'words'}`
}
