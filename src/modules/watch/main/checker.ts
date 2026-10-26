import { createHash } from 'crypto'
import type { Database } from 'better-sqlite3'
import { findDate, isOver } from '../shared/dates'
import { scoreText } from '../shared/relevance'
import { itemKind, type CheckOutcome, type ParsedItem, type WatchSource } from '../shared/types'
import { crossrefUrl, parseCrossref } from './parse-crossref'
import { parseFeed } from './parse-feed'
import { datedSentences, parsePage } from './parse-page'
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

interface Fetched {
  items: ParsedItem[]
  /** Page method: the page text, to tell a changed page from an unchanged one. */
  pageText?: string
  /** The page's cards carry their own dates (so sentences cut from its text are not wanted). */
  cards?: boolean
  notModified?: boolean
  etag?: string | null
  lastModified?: string | null
}

async function load(
  source: WatchSource,
  fetcher: Fetcher,
  etag: string | null,
  lastModified: string | null,
  today: string
): Promise<Fetched> {
  const headers: Record<string, string> = {
    'User-Agent': 'CentralCommand/1.0 (a local reader of public announcement pages)',
    Accept:
      source.method === 'crossref'
        ? 'application/json'
        : source.method === 'feed'
          ? 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5'
          : 'text/html, application/xhtml+xml;q=0.9, */*;q=0.5'
  }
  if (source.method !== 'crossref') {
    if (etag) headers['If-None-Match'] = etag
    if (lastModified) headers['If-Modified-Since'] = lastModified
  }
  const url = source.method === 'crossref' ? crossrefUrl(source.issn ?? '') : source.url
  const response = await fetcher(url, { headers })
  if (response.status === 304) return { items: [], notModified: true }
  if (response.status < 200 || response.status >= 300)
    throw new Error(`The site answered ${response.status}`)
  const body = await response.text()
  const meta = {
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified')
  }
  if (source.method === 'crossref') return { items: parseCrossref(body), ...meta }
  if (source.method === 'feed') return { items: parseFeed(body), ...meta }
  const page = parsePage(body, source.url)
  // A listing whose cards carry their own dates needs no sentences cut from its text: they run across cards.
  const cards = page.links.some((l) => findDate(`${l.title}\n${l.summary}`, today))
  return {
    items: [...page.links, ...(cards ? [] : datedSentences(page.text, source.url, today))],
    pageText: page.text,
    cards,
    ...meta
  }
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
  now: string
): Promise<CheckOutcome> {
  const baseline = source.lastOkAt === null
  const stamp = db.prepare(
    'UPDATE watch_sources SET last_checked_at = ?, last_error = ?, failures = ? WHERE id = ?'
  )
  try {
    const prior = db
      .prepare('SELECT etag, last_modified, page_hash FROM watch_sources WHERE id = ?')
      .get(source.id) as {
      etag: string | null
      last_modified: string | null
      page_hash: string | null
    }
    const got = await load(source, fetcher, prior.etag, prior.last_modified, isoDay(now))
    if (got.notModified) {
      db.prepare(
        'UPDATE watch_sources SET last_checked_at = ?, last_ok_at = ?, last_error = NULL, failures = 0 WHERE id = ?'
      ).run(now, now, source.id)
      return { sourceId: source.id, status: 'unchanged', added: 0, baseline: false }
    }

    const keywords = getKeywords(db)
    const today = isoDay(now)
    const insert = db.prepare(
      `INSERT OR IGNORE INTO watch_items
         (source_id, item_key, title, url, summary, published_at, date, date_kind, score, matched, state, first_seen_at, item_kind)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const update = db.prepare(
      `UPDATE watch_items SET summary = ?, date = ?, date_kind = ?, item_kind = ?
       WHERE source_id = ? AND item_key = ? AND summary = ''`
    )
    let added = 0
    db.transaction(() => {
      // Sentences stored before the page's cards were read with their dates ran across cards: they are not the user's to keep unless saved.
      if (got.cards)
        db.prepare(
          "DELETE FROM watch_items WHERE source_id = ? AND item_key LIKE 'text:%' AND state != 'saved'"
        ).run(source.id)
      for (const item of got.items) {
        if (added >= MAX_NEW_PER_CHECK) break
        const text = `${item.title}\n${item.summary}`
        const relevance = scoreText(item.title, item.summary, keywords)
        // Something already over (every date it names has passed) is never added, not even on the first check.
        if (isOver(text, today)) continue
        const dated = findDate(text, today)
        const kind = itemKind(item.title, source.kind)
        if (item.summary) {
          // Seen before without its description or date (stored when pages were read as bare links): complete it.
          update.run(
            item.summary,
            dated?.date ?? null,
            dated?.kind ?? null,
            kind,
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
          dated?.date ?? null,
          dated?.kind ?? null,
          relevance.score,
          relevance.matched.join(','),
          'new',
          now,
          kind
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
           etag = ?, last_modified = ?, page_hash = ?, changed_at = ? WHERE id = ?`
      ).run(now, now, got.etag ?? null, got.lastModified ?? null, pageHash, changedAt, source.id)
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
