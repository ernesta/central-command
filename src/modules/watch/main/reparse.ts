import type { Database } from 'better-sqlite3'
import { findDates, isOver } from '../shared/dates'
import type { WatchItem } from '../shared/types'
import { CREDITS, isSectionHome } from './parse-page'
import { listItems, listSources } from './repository'

/**
 * `npm run watch:reparse`: what the stored, UNSAVED items of the page sources look like under the rules the checker now uses, and
 * which of them it would not have stored. Nothing here reads the network; a saved item is never touched, and a source (its name,
 * address, kind) is never changed.
 */

export type RemoveReason =
  'a credit or a cookie notice' | "the site's menu" | 'no coming date' | 'already over'

export interface PlannedItem {
  item: WatchItem
  /** Null: the item stays. */
  remove: RemoveReason | null
}

export interface SourcePlan {
  sourceId: number
  title: string
  url: string
  method: string
  items: PlannedItem[]
  saved: number
}

const over = (item: WatchItem, today: string): boolean => {
  const dates = [item.eventEnd ?? item.eventDate, item.deadline].filter(
    (d): d is string => d !== null
  )
  return dates.length > 0 && dates.every((d) => d < today)
}

function judge(item: WatchItem, sourceUrl: string, today: string): RemoveReason | null {
  if (CREDITS.test(item.title)) return 'a credit or a cookie notice'
  if (item.url !== sourceUrl && isSectionHome(item.url, sourceUrl)) return "the site's menu"
  const text = `${item.title}\n${item.summary}`
  const stored = item.eventDate !== null || item.deadline !== null
  if (stored ? over(item, today) : isOver(text, today)) return 'already over'
  if (!stored) {
    const found = findDates(text, today)
    if (!found.eventStart && !found.deadline) return 'no coming date'
  }
  return null
}

/** Every page source's stored items judged by the new rules. Feeds and journals are left alone: their items are what the source announced. */
export function planReparse(db: Database, today: string): SourcePlan[] {
  const out: SourcePlan[] = []
  for (const source of listSources(db)) {
    if (source.method !== 'page' && source.method !== 'event') continue
    const items = listItems(db, { sourceId: source.id, limit: 1000 })
    out.push({
      sourceId: source.id,
      title: source.title,
      url: source.url,
      method: source.method,
      saved: items.filter((i) => i.state === 'saved').length,
      items: items
        .filter((i) => i.state !== 'saved')
        .map((item) => ({ item, remove: judge(item, source.url, today) }))
    })
  }
  return out
}

/**
 * Remove what the plan says to remove (never a saved item), and make each page source read afresh next time: its validators and page
 * hash are forgotten, and so is the way that worked last time. Returns how many items went.
 */
export function applyReparse(db: Database, plan: readonly SourcePlan[]): number {
  let removed = 0
  const drop = db.prepare(
    "DELETE FROM watch_items WHERE id = ? AND state != 'saved' AND manual = 0"
  )
  const forget = db.prepare(
    'UPDATE watch_sources SET etag = NULL, last_modified = NULL, page_hash = NULL, found_via = NULL, changed_at = NULL WHERE id = ?'
  )
  db.transaction(() => {
    for (const source of plan) {
      for (const p of source.items) if (p.remove) removed += drop.run(p.item.id).changes
      forget.run(source.sourceId)
    }
  })()
  return removed
}
