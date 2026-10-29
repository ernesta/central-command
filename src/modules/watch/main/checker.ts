import { createHash } from 'crypto'
import type { Database } from 'better-sqlite3'
import { findDates, isOver, structuredOver } from '../shared/dates'
import { scoreText } from '../shared/relevance'
import { sectionOf, type CheckOutcome, type WatchSource } from '../shared/types'
import { loadSource, resolveUndated, type LoadOptions } from './load-source'
import { getKeywords } from './repository'

/** The part of a web response the checker needs, so tests can stand in for the network. */
export interface FetchedResponse {
  status: number
  headers: { get(name: string): string | null }
  text(): Promise<string>
}
export type Fetcher = (
  url: string,
  init: { headers: Record<string, string> }
) => Promise<FetchedResponse>

/** One check adds at most this many items, so a page that rebuilt all its links cannot flood the list. */
export const MAX_NEW_PER_CHECK = 60

const sha = (text: string): string => createHash('sha256').update(text).digest('hex').slice(0, 24)

function isoDay(now: string): string {
  return now.slice(0, 10)
}

/**
 * Check one source and store what is new. Never throws: a problem is kept on the source (`last_error`, `failures`)
 * and returned, so one broken site does not stop the others.
 *
 * Everything a source has is new, the first check included (the user's call, 26 Oct 2026), except what is already
 * over: an item whose every written-out date has passed is not added. One check adds at most MAX_NEW_PER_CHECK.
 */
export async function checkSource(
  db: Database,
  source: WatchSource,
  fetcher: Fetcher,
  now: string,
  options: LoadOptions = {}
): Promise<CheckOutcome> {
  const baseline = source.lastOkAt === null
  const stamp = db.prepare(
    'UPDATE watch_sources SET last_checked_at = ?, last_error = ?, failures = ? WHERE id = ?'
  )
  try {
    const prior = db
      .prepare('SELECT etag, last_modified, page_hash, found_via FROM watch_sources WHERE id = ?')
      .get(source.id) as {
      etag: string | null
      last_modified: string | null
      page_hash: string | null
      found_via: string | null
    }
    const got = await loadSource(
      source,
      { etag: prior.etag, lastModified: prior.last_modified, foundVia: prior.found_via },
      fetcher,
      isoDay(now),
      options
    )
    const today = isoDay(now)
    if (got.notModified) {
      db.prepare(
        'UPDATE watch_sources SET last_checked_at = ?, last_ok_at = ?, last_error = NULL, failures = 0 WHERE id = ?'
      ).run(now, now, source.id)
      return { sourceId: source.id, status: 'unchanged', added: 0, baseline: false }
    }

    // Links with no date beside them may have one on their own page (a few per check; a miss is remembered for a fortnight).
    const items = [
      ...got.items,
      ...(await resolveUndated(db, source, got.undated ?? [], fetcher, today, now, options))
    ]
    const keywords = getKeywords(db)
    const insert = db.prepare(
      `INSERT OR IGNORE INTO watch_items
         (source_id, item_key, title, url, summary, published_at, event_date, event_end, deadline, deadline_label,
          score, matched, state, first_seen_at, section)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    // An item found again has its dates read again (an event that moved, a range that was once only a day); its description is filled in if it had none.
    const update = db.prepare(
      `UPDATE watch_items SET summary = CASE WHEN summary = '' THEN ? ELSE summary END,
         event_date = ?, event_end = ?, deadline = ?, deadline_label = ?, section = ?
       WHERE source_id = ? AND item_key = ?`
    )
    // A calendar, an event page or a "no upcoming events" page is the whole truth about its source.
    const refresh = db.prepare(
      `UPDATE watch_items SET title = ?, summary = ?, event_date = ?, event_end = ?, deadline = ?, deadline_label = ?, section = ?
       WHERE source_id = ? AND item_key = ?`
    )
    const current = items.filter((i) =>
      i.dates ? !structuredOver(i.dates, today) : !isOver(`${i.title}\n${i.summary}`, today)
    )
    let added = 0
    db.transaction(() => {
      if (got.sentences) {
        // Sentences cut from a page's text are found again by their wording: one that is gone from it (rewritten, past) goes too.
        const keep = new Set(current.map((i) => i.key))
        const rows = db
          .prepare(
            "SELECT id, item_key FROM watch_items WHERE source_id = ? AND item_key LIKE 'text:%' AND state != 'saved' AND manual = 0"
          )
          .all(source.id) as { id: number; item_key: string }[]
        const drop = db.prepare('DELETE FROM watch_items WHERE id = ?')
        for (const row of rows) if (!keep.has(row.item_key)) drop.run(row.id)
      }
      if (got.authoritative) {
        const keep = new Set(current.map((i) => i.key))
        const rows = db
          .prepare(
            "SELECT id, item_key FROM watch_items WHERE source_id = ? AND state != 'saved' AND manual = 0"
          )
          .all(source.id) as { id: number; item_key: string }[]
        const drop = db.prepare('DELETE FROM watch_items WHERE id = ?')
        for (const row of rows) if (!keep.has(row.item_key)) drop.run(row.id)
      }
      // Sentences stored before the page's cards were read with their dates ran across cards: they are not the user's to keep unless saved.
      if (got.cards)
        db.prepare(
          "DELETE FROM watch_items WHERE source_id = ? AND item_key LIKE 'text:%' AND state != 'saved' AND manual = 0"
        ).run(source.id)
      for (const item of current) {
        if (added >= MAX_NEW_PER_CHECK) break
        const text = `${item.title}\n${item.summary}`
        const relevance = scoreText(item.title, item.summary, keywords)
        const dated = item.dates ?? findDates(text, today)
        const section = sectionOf(item.title, item.summary)
        if (item.dates) {
          // Dates a calendar gave outright: a moved or renamed event is the same item, changed.
          refresh.run(
            item.title,
            item.summary,
            dated.eventStart,
            dated.eventEnd,
            dated.deadline,
            dated.deadlineLabel,
            section,
            source.id,
            item.key
          )
        } else {
          update.run(
            item.summary,
            dated.eventStart,
            dated.eventEnd,
            dated.deadline,
            dated.deadlineLabel,
            section,
            source.id,
            item.key
          )
        }
        const info = insert.run(
          source.id,
          item.key,
          item.title,
          item.url,
          item.summary,
          item.publishedAt,
          dated.eventStart,
          dated.eventEnd,
          dated.deadline,
          dated.deadlineLabel,
          relevance.score,
          relevance.matched.join(','),
          'new',
          now,
          section
        )
        added += info.changes
      }
      let changedAt: string | null = source.changedAt
      let pageHash = prior.page_hash
      if (got.pageText !== undefined) {
        pageHash = sha(got.pageText)
        // A page whose text changed but gave no new link is worth a look (a date moved, a course was added as plain text).
        if (!baseline && prior.page_hash !== null && prior.page_hash !== pageHash && added === 0)
          changedAt = now
      }
      db.prepare(
        `UPDATE watch_sources SET last_checked_at = ?, last_ok_at = ?, last_error = NULL, failures = 0,
           etag = ?, last_modified = ?, page_hash = ?, changed_at = ?, found_via = ? WHERE id = ?`
      ).run(
        now,
        now,
        got.etag ?? null,
        got.lastModified ?? null,
        pageHash,
        changedAt,
        got.via === undefined ? prior.found_via : got.via,
        source.id
      )
    })()
    return { sourceId: source.id, status: 'ok', added, baseline }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    stamp.run(now, message.slice(0, 300), source.failures + 1, source.id)
    return { sourceId: source.id, status: 'error', added: 0, baseline, error: message }
  }
}

/** Score every stored item again, after the keyword list changed. */
export function rescoreItems(db: Database): void {
  const keywords = getKeywords(db)
  const rows = db.prepare('SELECT id, title, summary FROM watch_items').all() as {
    id: number
    title: string
    summary: string
  }[]
  const update = db.prepare('UPDATE watch_items SET score = ?, matched = ? WHERE id = ?')
  db.transaction(() => {
    for (const row of rows) {
      const relevance = scoreText(row.title, row.summary, keywords)
      update.run(relevance.score, relevance.matched.join(','), row.id)
    }
  })()
}

/**
 * When a source is next due. A source that keeps failing is tried less and less often (the interval doubles per
 * failure, up to a week), so a site that is down or has moved is not hammered.
 */
export function nextCheckAt(
  source: Pick<WatchSource, 'lastCheckedAt' | 'intervalHours' | 'failures'>
): number {
  if (!source.lastCheckedAt) return 0
  const slowed = Math.min(source.intervalHours * 2 ** Math.min(source.failures, 8), 168)
  return Date.parse(source.lastCheckedAt) + Math.max(source.intervalHours, slowed) * 3_600_000
}

export function dueSources(sources: WatchSource[], now: string): WatchSource[] {
  const t = Date.parse(now)
  return sources
    .filter((s) => s.active && nextCheckAt(s) <= t)
    .sort((a, b) => (a.lastCheckedAt ?? '').localeCompare(b.lastCheckedAt ?? ''))
}
