/** Letters NFD does not decompose into base + accent. */
const EXTRA_FOLDS: Record<string, string> = { ł: 'l', ø: 'o', đ: 'd', ß: 'ss', æ: 'ae', œ: 'oe' }

/** Lowercase, strip accents: "Müller" and "muller" compare equal. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[łøđßæœ]/g, (c) => EXTRA_FOLDS[c])
}

const EXCERPT_LENGTH = 300

/**
 * A short plain-text version of a Markdown note, for search. Not a full Markdown
 * parser: it strips the common syntax so the excerpt reads as the words the user wrote.
 */
export function markdownToExcerpt(markdown: string, maxLength = EXCERPT_LENGTH): string {
  const text = markdown
    .replace(/\r\n?/g, '\n')
    .replace(/^```.*$/gm, ' ') // fence lines (keep the code itself)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images -> alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> link text
    .replace(/<[^>\n]+>/g, ' ') // inline html
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
    .replace(/^\s*>+\s?/gm, '') // blockquotes
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/gm, '') // list markers and checkboxes
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ') // horizontal rules
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, ' ') // table separator rows
    .replace(/\|/g, ' ') // table cell pipes
    .replace(/(\*\*|__|~~|[*_`])/g, '') // emphasis, strike, inline code markers
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLength ? text.slice(0, maxLength).trimEnd() : text
}
