export { markdownToExcerpt } from '@shared/text'

/**
 * How much of a note's plain text the index keeps for search: all of any note a person would write (a long thesis chapter
 * is about 100,000 characters). The cap only stops a huge pasted file from filling the index and every list sent to the window.
 */
export const SEARCH_TEXT_LENGTH = 200_000
