import { titleParts } from './rows'
import type { WatchItem, WatchWorkspace } from './types'

/** What the New task dialog starts with when it is opened from a Watch row. */
export interface WatchTaskPrefill {
  title: string
  workspace: WatchWorkspace
  /** The item's deadline, else its start date, else none. A past date is still given: the dialog and `LateChip` deal with it. */
  due: string | null
  /** The item's address, then its summary. */
  description: string
  watchItem: { id: number; url: string }
}

/** The longest summary the description carries; cut at a word. */
export const SUMMARY_LIMIT = 400

function cut(text: string): string {
  if (text.length <= SUMMARY_LIMIT) return text
  const head = text.slice(0, SUMMARY_LIMIT)
  const space = head.lastIndexOf(' ')
  return `${(space > SUMMARY_LIMIT / 2 ? head.slice(0, space) : head).replace(/[\s.,;:–-]+$/, '')}…`
}

export function watchTaskPrefill(item: WatchItem): WatchTaskPrefill {
  const summary = cut(item.summary.replace(/\s+/g, ' ').trim())
  return {
    title: titleParts(item.title).name,
    workspace: item.workspace,
    due: item.deadline ?? item.eventDate ?? null,
    description: [item.url, summary].filter(Boolean).join('\n\n'),
    watchItem: { id: item.id, url: item.url }
  }
}
