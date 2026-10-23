import type { ReadingListMeta } from './types'

/** Whether a reading list is still exactly what New reading list made: no title and nothing in it. Leaving such a list removes it. */
export function isUntouchedList(meta: ReadingListMeta, body: string): boolean {
  return meta.title.trim() === '' && body.trim() === ''
}
