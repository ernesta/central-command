import type { Database } from 'better-sqlite3'
import { findDate, findDates } from '../shared/dates'
import type { ParsedItem, WatchSource } from '../shared/types'
import type { Fetcher } from './checker'
import { crossrefUrl, parseCrossref } from './parse-crossref'
import { decodeEntities, parseFeed } from './parse-feed'
import { eventItem, keyDateLinks, namesOneEvent, pageTitle } from './parse-event'
import { datedSentences, mainContent, parsePage } from './parse-page'
import {
  advertisedCalendars,
  parseIcs,
  parseJsonLd,
  parseTribe,
  tribeEndpoint,
  tribeRequest
} from './parse-structured'

const USER_AGENT = 'CentralCommand/1.0 (a local reader of public announcement pages)'

/** How long to wait before the one retry of a request that failed on the network. */
export const RETRY_WAIT_MS = 2_000

/** The pages of a calendar's list read in one check (50 events a page). */
const MAX_CALENDAR_PAGES = 3

export interface LoadOptions {
  /** Waits before a retry; tests pass a no-op. */
  sleep?: (ms: number) => Promise<void>
  retryWaitMs?: number
}

export interface Fetched {
  items: ParsedItem[]
  /** Page method: the page text, to tell a changed page from an unchanged one. */
  pageText?: string
  /** The page's cards carry their own dates (so sentences cut from its text are not wanted). */
  cards?: boolean
  notModified?: boolean
  etag?: string | null
  lastModified?: string | null
  /** The list is the whole truth about the source (a calendar, an event page, "no upcoming events"): unsaved items not in it go. */
  authoritative?: boolean
  /** What worked, to try first next time (`found_via`); null forgets what was stored; absent leaves it. */
  via?: string | null
  /** Links of the page with no date beside them: each may have one on its own page. */
  undated?: ParsedItem[]
  /** The page's dated sentences are items (`text:` keys): the unsaved ones no longer in its text go. */
  sentences?: boolean
}

/** What a failed request says, in words the Sources table can show. */
export function describeFetchError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/timeout|aborted/i.test(message)) return 'The site took too long to answer'
  if (/ERR_NETWORK_CHANGED|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_ACCESS_DENIED/i.test(message))
    return 'The network was not available'
  if (/ERR_NAME_NOT_RESOLVED/i.test(message)) return 'The address could not be found'
  return message
}

export function statusError(status: number): Error {
  if (status === 403) return new Error('The site blocks automated requests (403)')
  if (status === 429) return new Error('The site is limiting requests (429)')
  if (status >= 500) return new Error(`The site had a problem (${status})`)
  return new Error(`The site answered ${status}`)
}

interface Got {
  status: number
  etag: string | null
  lastModified: string | null
  body: string
}

/** One request, tried a second time after a short wait when it failed on the network (a changed network, a timeout). */
async function get(
  fetcher: Fetcher,
  url: string,
  accept: string,
  conditional: { etag: string | null; lastModified: string | null } | null,
  options: LoadOptions
): Promise<Got> {
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: accept }
  if (conditional?.etag) headers['If-None-Match'] = conditional.etag
  if (conditional?.lastModified) headers['If-Modified-Since'] = conditional.lastModified
  let response
  try {
    response = await fetcher(url, { headers })
  } catch {
    await (options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))))(
      options.retryWaitMs ?? RETRY_WAIT_MS
    )
    try {
      response = await fetcher(url, { headers })
    } catch (error) {
      throw new Error(describeFetchError(error))
    }
  }
  if (response.status === 304) return { status: 304, etag: null, lastModified: null, body: '' }
  if (response.status < 200 || response.status >= 300) throw statusError(response.status)
  return {
    status: response.status,
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
    body: await response.text()
  }
}

const JSON_ACCEPT = 'application/json'
const ICAL_ACCEPT = 'text/calendar, text/plain;q=0.8, */*;q=0.5'
const HTML_ACCEPT = 'text/html, application/xhtml+xml;q=0.9, */*;q=0.5'

async function readTribe(
  fetcher: Fetcher,
  endpoint: string,
  today: string,
  options: LoadOptions
): Promise<ParsedItem[]> {
  const items: ParsedItem[] = []
  for (let page = 1; page <= MAX_CALENDAR_PAGES; page++) {
    const got = await get(fetcher, tribeRequest(endpoint, today, page), JSON_ACCEPT, null, options)
    const parsed = parseTribe(got.body)
    items.push(...parsed.events)
    if (page >= parsed.pages) break
  }
  return items
}

async function readIcal(
  fetcher: Fetcher,
  url: string,
  options: LoadOptions
): Promise<ParsedItem[]> {
  return parseIcs((await get(fetcher, url, ICAL_ACCEPT, null, options)).body)
}

/** What a source's remembered way (`found_via`) reads, or throws when the way no longer works. */
async function readVia(
  via: string,
  fetcher: Fetcher,
  today: string,
  options: LoadOptions
): Promise<ParsedItem[] | null> {
  if (via.startsWith('tribe:')) return readTribe(fetcher, via.slice(6), today, options)
  if (via.startsWith('ical:')) return readIcal(fetcher, via.slice(5), options)
  return null
}

/**
 * Read one source. For a page: the way that worked last time first (a calendar's data), and when it fails the discovery runs again; a
 * new page looks for a calendar API, a calendar file and `Event` data in its own markup, then reads it as one event (when the user said
 * so, or its name and dates say so), and only then falls back to its links and the sentences of its text.
 */
export async function loadSource(
  source: WatchSource,
  prior: { etag: string | null; lastModified: string | null; foundVia: string | null },
  fetcher: Fetcher,
  today: string,
  options: LoadOptions = {}
): Promise<Fetched> {
  if (source.method === 'crossref') {
    const got = await get(fetcher, crossrefUrl(source.issn ?? ''), JSON_ACCEPT, null, options)
    return { items: parseCrossref(got.body), etag: got.etag, lastModified: got.lastModified }
  }
  if (source.method === 'feed') {
    const got = await get(
      fetcher,
      source.url,
      'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5',
      prior,
      options
    )
    if (got.status === 304) return { items: [], notModified: true }
    return { items: parseFeed(got.body), etag: got.etag, lastModified: got.lastModified }
  }

  // A page (read as a list of events, or as one event).
  let forget = false
  if (prior.foundVia && source.method !== 'event') {
    try {
      const items = await readVia(prior.foundVia, fetcher, today, options)
      if (items) return { items, authoritative: true }
    } catch {
      forget = true
    }
  }
  // A page that is one event is read in full every time: its deadlines sit on other pages, which can change while it does not.
  const asEvent = source.method === 'event' || prior.foundVia === 'event'
  const got = await get(fetcher, source.url, HTML_ACCEPT, forget || asEvent ? null : prior, options)
  if (got.status === 304 && !forget && !asEvent) return { items: [], notModified: true }
  const html = got.body
  const meta = { etag: got.etag, lastModified: got.lastModified }
  const base = { ...meta, ...(forget ? { via: null } : {}) }

  if (source.method === 'event')
    return { ...(await readEventPage(html, source.url, fetcher, today, options)), ...base }

  // A calendar the page carries: its API, then a calendar file; either gives every field outright.
  const endpoint = tribeEndpoint(html, source.url)
  if (endpoint) {
    try {
      return {
        items: await readTribe(fetcher, endpoint, today, options),
        authoritative: true,
        via: `tribe:${endpoint}`,
        ...meta
      }
    } catch {
      // Not (or no longer) offered: the next way.
    }
  }
  for (const url of advertisedCalendars(html, source.url).slice(0, 3)) {
    try {
      return {
        items: await readIcal(fetcher, url, options),
        authoritative: true,
        via: `ical:${url}`,
        ...meta
      }
    } catch {
      // Not a calendar after all.
    }
  }
  const event = parseJsonLd(html, source.url)
  const page = parsePage(html, source.url)
  if (event.length > 0) return { items: event, pageText: page.text, ...base }

  // A page named like one event, with dates and no cards of its own, is that event.
  const cards = page.links.some((l) => findDate(`${l.title}\n${l.summary}`, today))
  if (
    !page.none &&
    !cards &&
    namesOneEvent(pageTitle(html)) &&
    findDates(page.upcomingText, '0000-01-01').eventStart
  )
    return {
      ...(await readEventPage(html, source.url, fetcher, today, options)),
      ...base,
      via: 'event'
    }

  const links = page.links.filter(
    // A link to another site is an item only when it carries a coming date of its own.
    (l) => !l.offsite || findDate(`${l.title}\n${l.summary}`, today)
  )
  const dated = links.filter((l) => findDate(`${l.title}\n${l.summary}`, today))
  const undated = links.filter((l) => !dated.includes(l))
  return {
    // Prose that names dates is an item of its own, unless the cards carry theirs.
    items: [...dated, ...(cards ? [] : datedSentences(page.upcomingText, source.url, today))],
    undated,
    pageText: page.text,
    cards,
    sentences: !cards,
    authoritative: page.none,
    ...base
  }
}

/** A page that is one event: the page is the item, and the key-dates pages it links to say its deadlines. */
async function readEventPage(
  html: string,
  url: string,
  fetcher: Fetcher,
  today: string,
  options: LoadOptions
): Promise<Fetched> {
  const others: string[] = []
  for (const link of keyDateLinks(html, url)) {
    try {
      const got = await get(fetcher, link, HTML_ACCEPT, null, options)
      others.push(mainText(got.body))
    } catch {
      // A key-dates page that will not open leaves its deadlines out; the event itself is still there.
    }
  }
  const item = eventItem(html, url, today, others)
  return { items: item ? [item] : [], authoritative: true, pageText: mainText(html) }
}

const mainText = (html: string): string =>
  decodeEntities(mainContent(html).replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()

/** Own-page lookups in one check, and how long a link with no coming date is left alone. */
export const MAX_OWN_PAGE_LOOKUPS = 5
const SKIP_DAYS = 14

/**
 * Links of a listing with no date beside them: each is looked up on its own page (its `Event` data, else the dates in its text), a few
 * per check. One that has a coming date becomes an item with it; one that has none is remembered, so it is not asked again for two
 * weeks. A link already stored is left as it is.
 */
export async function resolveUndated(
  db: Database,
  source: WatchSource,
  undated: readonly ParsedItem[],
  fetcher: Fetcher,
  today: string,
  now: string,
  options: LoadOptions = {}
): Promise<ParsedItem[]> {
  const known = db.prepare('SELECT 1 FROM watch_items WHERE source_id = ? AND item_key = ?')
  const skipped = db.prepare(
    'SELECT checked_at FROM watch_skipped WHERE source_id = ? AND item_key = ?'
  )
  const remember = db.prepare(
    'INSERT OR REPLACE INTO watch_skipped (source_id, item_key, checked_at) VALUES (?, ?, ?)'
  )
  const cutoff = new Date(Date.parse(now) - SKIP_DAYS * 86_400_000).toISOString()
  const found: ParsedItem[] = []
  let lookups = 0
  for (const link of undated) {
    if (lookups >= MAX_OWN_PAGE_LOOKUPS) break
    if (known.get(source.id, link.key)) continue
    const before = skipped.get(source.id, link.key) as { checked_at: string } | undefined
    if (before && before.checked_at > cutoff) continue
    lookups++
    let body: string
    try {
      body = (await get(fetcher, link.url, HTML_ACCEPT, null, options)).body
    } catch {
      continue
    }
    const own = parseJsonLd(body, link.url).find((e) => e.dates?.eventStart)
    const dates = own?.dates ?? findDates(mainText(body), today)
    const usable = 'eventStart' in dates && (dates.eventStart || dates.deadline)
    if (usable) found.push({ ...link, summary: own?.summary ?? '', dates })
    else remember.run(source.id, link.key, now)
  }
  return found
}
